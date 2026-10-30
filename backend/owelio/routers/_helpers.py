from collections.abc import Callable
from typing import TypeVar

from owelio.errors import ApiError, raise_api_error

T = TypeVar("T")


def run_store(fn: Callable[[], T]) -> T:
    try:
        return fn()
    except ApiError as exc:
        raise_api_error(exc)
