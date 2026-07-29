import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status


class InMemoryRateLimiter:
    """Pilot-safe limiter. Use Redis-backed storage before scaling API replicas."""

    def __init__(self):
        self._events: dict[str, deque[float]] = defaultdict(deque)

    def enforce(self, key: str, limit: int, window_seconds: int) -> None:
        now = time.monotonic()
        events = self._events[key]
        while events and events[0] <= now - window_seconds:
            events.popleft()
        if len(events) >= limit:
            retry_after = max(1, round(window_seconds - (now - events[0])))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests",
                headers={"Retry-After": str(retry_after)},
            )
        events.append(now)


rate_limiter = InMemoryRateLimiter()


def enforce_rate_limit(request: Request, bucket: str, limit: int, window_seconds: int = 60) -> None:
    client = request.client.host if request.client else "unknown"
    rate_limiter.enforce(f"{bucket}:{client}", limit, window_seconds)
