"""Uniform API error handling.

Every non-2xx response uses the same body::

    {"error": {"code": "snake_case_code", "title_de": "Deutsche Meldung",
               "message": "Deutsche Meldung"}}

``title_de`` is the contract field consumed by the frontend; ``message``
carries the same German text as a compatibility alias.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

logger = logging.getLogger(__name__)

GENERIC_MESSAGES: dict[int, tuple[str, str]] = {
    400: ("bad_request", "Die Anfrage ist ungültig."),
    401: ("unauthorized", "Nicht angemeldet. Bitte melde dich an."),
    403: ("forbidden", "Dafür fehlt dir die Berechtigung."),
    404: ("not_found", "Nicht gefunden."),
    405: ("method_not_allowed", "Diese Methode ist für die Route nicht erlaubt."),
    409: ("conflict", "Die Anfrage steht im Konflikt mit dem aktuellen Zustand."),
    413: ("payload_too_large", "Die Datei ist zu groß."),
    422: ("validation_error", "Die Eingaben sind ungültig."),
    429: ("rate_limited", "Zu viele Versuche. Bitte warte einen Moment."),
    500: ("internal_error", "Ein interner Serverfehler ist aufgetreten."),
    501: ("not_implemented", "Diese Funktion ist noch nicht verfügbar."),
}

INTERNAL_ERROR_MESSAGE = GENERIC_MESSAGES[500][1]


class ApiError(Exception):
    """An expected API failure with a stable machine code and German message."""

    def __init__(self, status_code: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


def error_body(code: str, message: str) -> dict[str, dict[str, str]]:
    return {"error": {"code": code, "title_de": message, "message": message}}


def error_response(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content=error_body(code, message))


class UnhandledErrorMiddleware(BaseHTTPMiddleware):
    """Turn an unexpected exception into the uniform body inside the CORS layer.

    Starlette's ``ServerErrorMiddleware`` sits outside the user middleware, so
    a response produced there loses its CORS headers.  This middleware is
    added before ``CORSMiddleware`` and therefore runs inside it.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        try:
            return await call_next(request)
        except Exception as exc:
            logger.error(
                "Unhandled %s while processing %s %s",
                type(exc).__name__,
                request.method,
                request.url.path,
            )
            return error_response(500, "internal_error", INTERNAL_ERROR_MESSAGE)


def _message_for_status(status_code: int) -> tuple[str, str]:
    return GENERIC_MESSAGES.get(
        status_code,
        ("http_error", "Die Anfrage konnte nicht verarbeitet werden."),
    )


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def handle_api_error(_: Request, exc: ApiError) -> JSONResponse:
        return error_response(exc.status_code, exc.code, exc.message)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        code, message = GENERIC_MESSAGES[422]
        return error_response(422, code, message)

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        if isinstance(exc.detail, dict):
            code = str(exc.detail.get("code") or "http_error")
            message = str(exc.detail.get("title_de") or exc.detail.get("message") or "")
            if message:
                return error_response(exc.status_code, code, message)
        code, message = _message_for_status(exc.status_code)
        return error_response(exc.status_code, code, message)

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        logger.error(
            "Unhandled %s while processing %s %s",
            type(exc).__name__,
            request.method,
            request.url.path,
        )
        return error_response(500, "internal_error", INTERNAL_ERROR_MESSAGE)
