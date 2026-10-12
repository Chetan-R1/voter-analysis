"""Structured output returned by the LLM for one page of a ward roll PDF.

No field has a default: OpenAI strict Structured Outputs needs every field present,
so optional values are expressed as nullable.
"""

from typing import Literal

from pydantic import BaseModel, Field

DeletionCode = Literal["E", "S", "R"]  # E = death, S = shifted, R = repeated entry


class CoverInfo(BaseModel):
    district: str = Field(description="जिलापरिषद का नाम")
    panchayat_samiti: str = Field(description="पंचायत समिति का नाम")
    gram_panchayat: str = Field(description="ग्रामपंचायत")
    ward_no: int = Field(description="वार्ड क्रमांक")
    tehsil: str | None
    main_village: str | None = Field(description="मुख्य गांव")
    assembly_constituency: str | None = Field(description="विधानसभा क्षेत्र, e.g. '36-दांतारामगढ'")
    zp_constituency: int | None = Field(description="जि॰ प॰ सदस्य निर्वाचन क्षेत्र")
    ps_constituency: int | None = Field(description="पं॰ स॰ सदस्य निर्वाचन क्षेत्र")
    booth_no: int | None
    booth_name: str | None
    ward_boundary: str | None = Field(description="वार्ड का परिसीमन के अनुसार विवरण")
    first_serial: int | None
    last_serial: int | None
    male: int | None
    female: int | None
    third_gender: int | None
    total: int | None


class VoterEntry(BaseModel):
    serial_no: int
    epic_no: str
    name: str = Field(description="Name exactly as printed, in Devanagari")
    name_en: str = Field(description="Name transliterated to Latin script")
    relative_name: str = Field(description="Father's/husband's name exactly as printed, in Devanagari")
    relative_name_en: str
    relation_type: Literal["father", "husband", "mother", "other"]
    house_no: str
    age: int
    gender: Literal["male", "female", "third"]
    hamlet: str | None = Field(
        description="Section heading above this box (e.g. 'हरितवालों की ढाणी ,भगवानपुरा'); "
        "null if no heading appears above it on this page"
    )
    deletion_mark: DeletionCode | None = Field(
        description="Letter printed before the serial number (e.g. 'E 28'), or null"
    )


class DeletionEntry(BaseModel):
    serial_no: int
    epic_no: str
    code: DeletionCode


class SummaryInfo(BaseModel):
    original_male: int | None
    original_female: int | None
    original_third: int | None
    original_total: int | None
    added_total: int | None
    deleted_total: int | None
    final_male: int | None
    final_female: int | None
    final_third: int | None
    final_total: int | None


class PageExtraction(BaseModel):
    page_type: Literal["cover", "map", "voters", "supplement", "summary", "other"]
    cover: CoverInfo | None
    voters: list[VoterEntry]
    additions: list[VoterEntry]
    deletions: list[DeletionEntry]
    summary: SummaryInfo | None
