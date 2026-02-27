"""Utilities for handling MarkItDown file conversion requests."""

import os
import tempfile
import traceback
from pathlib import Path
from urllib.parse import urlparse

import aiohttp
from fastapi import HTTPException
from markitdown import MarkItDown

MAX_MARKITDOWN_BYTES = 50 * 1024 * 1024


def _resolve_supabase_hostname() -> str | None:
    supabase_url = (os.getenv("SUPABASE_URL") or "").strip()
    if not supabase_url:
        return None

    parsed = urlparse(supabase_url)
    if parsed.hostname:
        return parsed.hostname.lower()

    parsed_with_scheme = (
        urlparse(f"https://{supabase_url}") if "://" not in supabase_url else parsed
    )
    if parsed_with_scheme.hostname:
        return parsed_with_scheme.hostname.lower()

    return None


async def handle_markitdown(
    signed_url: str,
    filename: str | None,
    enable_plugins: bool,
) -> dict[str, object]:
    """Download a signed Supabase URL and convert the file to markdown."""
    if not signed_url:
        raise HTTPException(status_code=400, detail="signed_url is required")

    configured_supabase_host = _resolve_supabase_hostname()
    if not configured_supabase_host:
        raise HTTPException(status_code=500, detail="Supabase host is not configured")

    parsed = urlparse(signed_url)
    if parsed.scheme != "https":
        raise HTTPException(status_code=400, detail="Invalid signed URL scheme")
    if parsed.hostname is None or parsed.hostname.lower() != configured_supabase_host:
        raise HTTPException(status_code=400, detail="Invalid signed URL host")
    if "/storage/v1/object/sign/" not in parsed.path:
        raise HTTPException(status_code=400, detail="Invalid Supabase signed URL")
    if "token=" not in parsed.query:
        raise HTTPException(status_code=400, detail="Invalid signed URL token")

    original_name = (filename or "upload.bin").strip() or "upload.bin"
    suffix = Path(original_name).suffix
    temp_path = ""

    try:
        timeout = aiohttp.ClientTimeout(total=60)
        downloaded_bytes = 0
        async with (
            aiohttp.ClientSession(timeout=timeout) as session,
            session.get(signed_url) as response,
        ):
            if response.status >= 400:
                raise HTTPException(
                    status_code=400,
                    detail=(f"Failed to download from signed URL ({response.status})"),
                )

            content_length_raw = response.headers.get("Content-Length")
            if content_length_raw:
                try:
                    content_length = int(content_length_raw)
                except ValueError as error:
                    raise HTTPException(
                        status_code=400,
                        detail="Invalid Content-Length from signed URL",
                    ) from error
                if content_length > MAX_MARKITDOWN_BYTES:
                    raise HTTPException(status_code=413, detail="File exceeds 50MB limit")

            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                temp_path = tmp.name
                async for chunk in response.content.iter_chunked(1024 * 256):
                    if not chunk:
                        continue
                    downloaded_bytes += len(chunk)
                    if downloaded_bytes > MAX_MARKITDOWN_BYTES:
                        raise HTTPException(status_code=413, detail="File exceeds 50MB limit")
                    tmp.write(chunk)

        if downloaded_bytes == 0:
            raise HTTPException(status_code=400, detail="File is empty")

        converter = MarkItDown(enable_plugins=enable_plugins)
        result = converter.convert(temp_path)
        markdown = (getattr(result, "text_content", "") or "").strip()

        if not markdown:
            raise HTTPException(status_code=422, detail="MarkItDown returned empty markdown")

        return {
            "ok": True,
            "markdown": markdown,
            "title": getattr(result, "title", None),
            "filename": original_name,
        }
    except HTTPException:
        raise
    except Exception as error:
        print(f"🤖: markitdown conversion failed: {error}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to convert file") from error
    finally:
        try:
            temp_file = Path(temp_path) if temp_path else None
            if temp_file and temp_file.exists():
                temp_file.unlink()
        except Exception as cleanup_error:
            print(f"🤖: markitdown cleanup failed: {cleanup_error}")
