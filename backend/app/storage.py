from functools import lru_cache
from pathlib import Path

import boto3
from botocore.config import Config

from app.config import get_settings


@lru_cache
def _client():
    s = get_settings()
    if not (s.r2_account_id and s.r2_access_key_id and s.r2_secret_access_key):
        raise RuntimeError("R2 credentials missing: set R2_* values in backend/.env")
    return boto3.client(
        "s3",
        endpoint_url=f"https://{s.r2_account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=s.r2_access_key_id,
        aws_secret_access_key=s.r2_secret_access_key,
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )


def upload_file(path: Path, key: str) -> None:
    _client().upload_file(str(path), get_settings().r2_bucket, key,
                          ExtraArgs={"ContentType": "application/pdf"})


def download_file(key: str, path: Path) -> None:
    _client().download_file(get_settings().r2_bucket, key, str(path))


def presigned_get_url(key: str, expires: int = 600) -> str:
    return _client().generate_presigned_url(
        "get_object", Params={"Bucket": get_settings().r2_bucket, "Key": key}, ExpiresIn=expires
    )


def presigned_put_url(key: str, expires: int = 600) -> str:
    return _client().generate_presigned_url(
        "put_object",
        Params={"Bucket": get_settings().r2_bucket, "Key": key, "ContentType": "application/pdf"},
        ExpiresIn=expires,
    )
