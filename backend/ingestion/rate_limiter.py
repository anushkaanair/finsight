"""Simple token-bucket rate limiter for EDGAR requests."""
import time
import threading


class RateLimiter:
    """Allow at most *rate* calls per second (default 8)."""

    def __init__(self, rate: float = 8.0):
        self._rate = rate
        self._min_interval = 1.0 / rate
        self._last_call = 0.0
        self._lock = threading.Lock()

    def wait(self) -> None:
        with self._lock:
            elapsed = time.monotonic() - self._last_call
            remaining = self._min_interval - elapsed
            if remaining > 0:
                time.sleep(remaining)
            self._last_call = time.monotonic()


# Module-level singleton used by edgar_client
edgar_limiter = RateLimiter(rate=8.0)
