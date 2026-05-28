import time
import uuid
import json
import logging
import sys
import os
from typing import Any, Dict
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

# Centralized Logger instances
logger = logging.getLogger("app")
api_logger = logging.getLogger("app.api")
db_logger = logging.getLogger("app.db")

class StructuredJSONFormatter(logging.Formatter):
    """
    Custom formatter to output logs in structured JSON format.
    Ensures logs are clean and machine-readable for log collectors (Railway, Datadog, ELK, etc.).
    """
    def format(self, record: logging.LogRecord) -> str:
        log_record: Dict[str, Any] = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
            "filename": record.pathname.split("/")[-1],
            "line": record.lineno,
        }
        
        # Inject trace/request context if attached to the record
        if hasattr(record, "request_id"):
            log_record["request_id"] = record.request_id
            
        if record.exc_info:
            log_record["exception"] = self.formatException(record.exc_info)
            
        # Merge extra context dict if provided
        if hasattr(record, "extra_context"):
            log_record.update(record.extra_context)
            
        return json.dumps(log_record)


def configure_logging() -> None:
    """
    Configures loggers depending on the environment (JSON in production, pretty text in development).
    """
    is_production = os.getenv("ENVIRONMENT", "development").lower() == "production"
    log_level = logging.INFO if is_production else logging.DEBUG
    
    # Root logging handler
    handler = logging.StreamHandler(sys.stdout)
    if is_production:
        handler.setFormatter(StructuredJSONFormatter())
    else:
        # Standard clean human-readable log formatting for development
        formatter = logging.Formatter(
            "[%(asctime)s] %(levelname)s [%(name)s:%(lineno)d] - %(message)s",
            datefmt="%H:%M:%S"
        )
        handler.setFormatter(formatter)
        
    # Configure all app loggers
    for logger_name in ["app", "app.api", "app.db", "app.diagnostics"]:
        l = logging.getLogger(logger_name)
        l.setLevel(log_level)
        l.handlers = []
        l.addHandler(handler)
        l.propagate = False


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware that intercepts all HTTP requests to log latency,
    method, URL, status code, and attach unique request/correlation IDs.
    """
    async def dispatch(self, request: Request, call_next: Any) -> Response:
        # 1. Fetch or generate Correlation ID (Request ID)
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        
        # Store on state so it's accessible down the line
        request.state.request_id = request_id
        
        start_time = time.time()
        
        # Setup basic logging context for the active request thread
        extra = {
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "client_ip": request.client.host if request.client else "unknown"
        }
        
        api_logger.debug(f"Request started: {request.method} {request.url.path}", extra={"extra_context": extra})
        
        try:
            response = await call_next(request)
            
            # Compute latency
            duration = (time.time() - start_time) * 1000
            
            # Inject Correlation ID in response headers
            response.headers["X-Request-ID"] = request_id
            
            extra.update({
                "status_code": response.status_code,
                "duration_ms": round(duration, 2)
            })
            
            log_msg = f"Request completed: {request.method} {request.url.path} | Status: {response.status_code} | Latency: {duration:.2f}ms"
            
            if response.status_code >= 500:
                api_logger.error(log_msg, extra={"extra_context": extra})
            elif response.status_code >= 400:
                api_logger.warning(log_msg, extra={"extra_context": extra})
            else:
                api_logger.info(log_msg, extra={"extra_context": extra})
                
            return response
            
        except Exception as e:
            duration = (time.time() - start_time) * 1000
            extra.update({
                "status_code": 500,
                "duration_ms": round(duration, 2),
                "error": str(e)
            })
            api_logger.exception(
                f"Unhandled exception during request {request.method} {request.url.path} after {duration:.2f}ms",
                extra={"extra_context": extra}
            )
            raise
