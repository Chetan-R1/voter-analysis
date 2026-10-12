from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    database_url: str = "postgresql+psycopg://voter:voter@localhost:5433/voter_analysis"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"

    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket: str = "voter-pdfs"

    render_dpi: int = 200
    llm_workers: int = 4
    llm_cache_dir: Path = BACKEND_DIR / ".cache" / "llm"


@lru_cache
def get_settings() -> Settings:
    return Settings()
