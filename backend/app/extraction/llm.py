import time

from google import genai
from google.genai import types

from app.config import get_settings
from app.extraction.schemas import PageExtraction

SYSTEM_PROMPT = """\
You extract data from one page of a Rajasthan State Election Commission panchayat electoral roll
(पंचायत चुनाव निर्वाचक नामावली). The page is an image. Return data that matches the schema exactly.

Page types:
- "cover": first page with district, panchayat samiti, gram panchayat, ward, booth, revision details
  and the voter count table (आरम्भिक/अंतिम क्रम संख्या, पुरुष, स्त्री, तृतीय लिंग, योग). Fill `cover`.
- "map": the ward map (वार्ड का नक्शा). Return nothing else.
- "voters": grid of voter boxes. Fill `voters` with EVERY box on the page, in serial order.
- "supplement": पूरक page. Put boxes listed under परिवर्धन सूची (additions) in `additions`
  and boxes under विलोपन सूची (deletions) in `deletions` with their code letter.
- "summary": संक्षिप्त विवरण table. Fill `summary`: मूल सूची -> original_*, परिवर्धन -> added_total,
  विलोपन -> deleted_total, the final (I+II-III) row -> final_*.

Each voter box contains: serial number (top-left, sometimes preceded by a letter E/S/R meaning
deleted), EPIC number (top, e.g. RJ/05/034/282246 or RJM1045699 or BZR1795418), नाम (name),
पिता का नाम (father -> relation_type "father") or पति का नाम (husband -> "husband") or माता का नाम
(mother -> "mother"), मकान संख्या (house number), आयु (age), लिंग (पुरुष=male, स्त्री=female,
तृतीय लिंग=third).

Rules:
- Copy Devanagari names exactly as printed, with correct matras. Do not translate.
- Also give a natural Latin transliteration (e.g. "मेघराज" -> "Meghraj").
- Copy EPIC numbers character-for-character.
- house_no: copy as printed (it may use Devanagari digits like ५१).
- Section headings such as "हरितवालों की ढाणी ,भगवानपुरा" apply to all boxes below them until the
  next heading. Set `hamlet` to the heading text; use null for boxes that have no heading above
  them on this page.
- Ignore "Photo is Available" text and any DELETED watermark (but keep the E/S/R letter).
- Leave unrelated fields null / empty lists.
"""

FALLBACK_MODELS = [
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
]


def extract_page(image_png: bytes, page_no: int, total_pages: int, cache_key: str) -> PageExtraction:
    """Run the vision model on one page image. Results are cached on disk."""
    s = get_settings()
    cache_file = s.llm_cache_dir / f"{cache_key}.json"
    if cache_file.exists():
        return PageExtraction.model_validate_json(cache_file.read_text(encoding="utf-8"))

    if not s.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY missing: set it in backend/.env")

    client = genai.Client(api_key=s.gemini_api_key)

    models_to_try = [s.gemini_model] + [m for m in FALLBACK_MODELS if m != s.gemini_model]
    last_error: Exception | None = None

    for model in models_to_try:
        for attempt in range(4):
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=[
                        types.Part.from_text(text=SYSTEM_PROMPT),
                        types.Part.from_text(text=f"Page {page_no} of {total_pages}."),
                        types.Part.from_bytes(data=image_png, mime_type="image/png"),
                    ],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=PageExtraction,
                        temperature=0,
                    ),
                )
                text = response.text
                if not text:
                    raise RuntimeError(f"Model returned no output for page {page_no}")
                result = PageExtraction.model_validate_json(text)
                cache_file.parent.mkdir(parents=True, exist_ok=True)
                cache_file.write_text(result.model_dump_json(indent=2), encoding="utf-8")
                return result

            except Exception as e:
                last_error = e
                err = str(e)
                if "503" in err or "UNAVAILABLE" in err:
                    wait = 15 * (2 ** attempt)
                    print(f"[page {page_no}] {model} 503, waiting {wait}s...")
                    time.sleep(wait)
                    continue
                elif "404" in err or "NOT_FOUND" in err:
                    print(f"[page {page_no}] {model} not available, trying next...")
                    break
                else:
                    raise

    raise RuntimeError(f"All models failed for page {page_no}: {last_error}")
