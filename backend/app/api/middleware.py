import logging
import json
from typing import Any
from fastapi import Request, Response, HTTPException, status, UploadFile
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger("app.security")

# Initialize SlowAPI Limiter
limiter = Limiter(key_func=get_remote_address)

# Max file upload size: 15 MB
MAX_UPLOAD_SIZE = 15 * 1024 * 1024  

class ContentLengthLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware that checks the Content-Length header of incoming POST/PUT/PATCH requests
    and rejects them with HTTP 413 Payload Too Large if they exceed the maximum size.
    This prevents memory exhaustion before reading the request stream.
    """
    async def dispatch(self, request: Request, call_next: Any) -> Response:
        if request.method in ["POST", "PUT", "PATCH"]:
            content_length = request.headers.get("content-length")
            if content_length:
                try:
                    size = int(content_length)
                    if size > MAX_UPLOAD_SIZE:
                        logger.warning(
                            f"Request rejected: Content-Length {size} exceeds limit of {MAX_UPLOAD_SIZE} bytes. "
                            f"Client IP: {request.client.host if request.client else 'unknown'}"
                        )
                        return Response(
                            content=json.dumps({"detail": "Payload too large. Maximum size allowed is 15MB."}),
                            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            media_type="application/json"
                        )
                except ValueError:
                    return Response(
                        content=json.dumps({"detail": "Invalid Content-Length header."}),
                        status_code=status.HTTP_400_BAD_REQUEST,
                        media_type="application/json"
                    )
        return await call_next(request)


async def validate_uploaded_file(file: UploadFile) -> UploadFile:
    """
    FastAPI Dependency to validate uploaded files in-depth:
    1. Reads a small chunk to check file size (redundant double-check).
    2. Validates PDF magic numbers (%PDF-).
    3. Validates JSON parsing if JSON.
    4. Validates UTF-8 text formatting for text/markdown logs.
    """
    # Read the first 1MB to check headers and verify signature
    head = await file.read(1024 * 1024)
    
    # Check total size if possible or calculate it from stream
    await file.seek(0, 2)  # seek to end of file
    file_size = await file.tell()
    await file.seek(0)  # reset file pointer to beginning

    if file_size > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum upload size allowed is 15MB."
        )

    filename = file.filename.lower() if file.filename else ""
    
    # 1. PDF Validation
    if filename.endswith(".pdf") or file.content_type == "application/pdf":
        if not head.startswith(b"%PDF"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file signature: File claims to be a PDF but does not start with %PDF."
            )
            
    # 2. JSON Validation
    elif filename.endswith(".json") or file.content_type == "application/json":
        try:
            # Try to decode the initial chunk as JSON
            full_content = await file.read()
            await file.seek(0) # reset
            json.loads(full_content.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid JSON file format: {str(e)}"
            )
            
    # 3. Markdown / Text Validation
    elif filename.endswith((".md", ".txt", ".markdown")) or file.content_type in ["text/markdown", "text/plain"]:
        try:
            full_content = await file.read()
            await file.seek(0) # reset
            full_content.decode("utf-8")
        except UnicodeDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file format: Text/Markdown logs must be UTF-8 decodable plain text."
            )
            
    # 4. Fallback: block other extensions that could be malicious executables (e.g. exe, sh, py, php)
    else:
        forbidden_extensions = (".exe", ".sh", ".bash", ".py", ".js", ".php", ".html", ".htm", ".bat", ".cmd")
        if filename.endswith(forbidden_extensions):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File type is not supported. Supported formats: .pdf, .json, .md, .txt"
            )

    return file
