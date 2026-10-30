from typing import Literal

from fastapi import HTTPException, status

ErrorCode = Literal["unauthenticated", "forbidden", "not_found", "invalid", "conflict"]


class ApiError(Exception):
    def __init__(self, message: str, code: ErrorCode) -> None:
        super().__init__(message)
        self.message = message
        self.code = code


def http_status_for_code(code: ErrorCode) -> int:
    return {
        "unauthenticated": status.HTTP_401_UNAUTHORIZED,
        "forbidden": status.HTTP_403_FORBIDDEN,
        "not_found": status.HTTP_404_NOT_FOUND,
        "invalid": status.HTTP_400_BAD_REQUEST,
        "conflict": status.HTTP_409_CONFLICT,
    }[code]


def raise_api_error(exc: ApiError) -> None:
    raise HTTPException(
        status_code=http_status_for_code(exc.code),
        detail={"code": exc.code, "message": exc.message},
    )
