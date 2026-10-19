"""In-memory rate limiting for the authentication endpoints.

The limiter counts failed attempts per client inside a sliding time window.
It is process-local, which fits the single-process API this product runs; a
multi-process deployment would move the same counters into a shared store.
"""

from __future__ import annotations

import threading
import time
from collections import deque
from collections.abc import Callable

from fastapi import Request

DEFAULT_MAX_ATTEMPTS = 10
DEFAULT_WINDOW_SECONDS = 60.0


class SlidingWindowLimiter:
    """Count failed attempts per key inside a sliding time window."""

    def __init__(
        self,
        max_attempts: int = DEFAULT_MAX_ATTEMPTS,
        window_seconds: float = DEFAULT_WINDOW_SECONDS,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._max_attempts = max_attempts
        self._window_seconds = window_seconds
        self._clock = clock
        self._attempts: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def _prune(self, key: str, now: float) -> deque[float]:
        attempts = self._attempts.setdefault(key, deque())
        cutoff = now - self._window_seconds
        while attempts and attempts[0] <= cutoff:
            attempts.popleft()
        return attempts

    def is_limited(self, key: str) -> bool:
        """Return whether ``key`` already used up its attempts in the window."""

        with self._lock:
            now = self._clock()
            return len(self._prune(key, now)) >= self._max_attempts

    def record_failure(self, key: str) -> None:
        """Count one failed attempt for ``key``."""

        with self._lock:
            now = self._clock()
            self._prune(key, now).append(now)

    def reset(self, key: str) -> None:
        """Forget the attempts recorded for ``key`` (for example after success)."""

        with self._lock:
            self._attempts.pop(key, None)

    def clear(self) -> None:
        """Forget every recorded attempt."""

        with self._lock:
            self._attempts.clear()

    def retry_after(self, key: str) -> int:
        """Return the seconds until ``key`` may try again (0 when not limited)."""

        with self._lock:
            now = self._clock()
            attempts = self._prune(key, now)
            if len(attempts) < self._max_attempts:
                return 0
            remaining = self._window_seconds - (now - attempts[0])
            return max(1, int(remaining) + 1)


def client_key(request: Request) -> str:
    """Return a stable identifier for the calling client."""

    if request.client is not None and request.client.host:
        return request.client.host
    return "unknown"


login_limiter = SlidingWindowLimiter()
register_limiter = SlidingWindowLimiter()
