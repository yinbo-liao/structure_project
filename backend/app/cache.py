"""Optional Redis cache with graceful fallback to in-memory cache."""
import os
import json
import time
import logging
from functools import wraps
from typing import Optional

logger = logging.getLogger(__name__)

_redis = None
_redis_available = False

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

try:
    import redis
    _redis = redis.from_url(REDIS_URL, socket_connect_timeout=1, decode_responses=True)
    _redis.ping()
    _redis_available = True
    logger.info("Redis connected for caching")
except Exception:
    logger.info("Redis not available, using in-memory cache")

# Fallback in-memory cache
_memory_cache: dict = {}


def cache_get(key: str) -> Optional[str]:
    if _redis_available:
        try:
            return _redis.get(key)
        except Exception:
            pass
    entry = _memory_cache.get(key)
    if entry and entry["expires"] > time.time():
        return entry["value"]
    return None


def cache_set(key: str, value: str, ttl: int = 300):
    if _redis_available:
        try:
            _redis.setex(key, ttl, value)
            return
        except Exception:
            pass
    _memory_cache[key] = {"value": value, "expires": time.time() + ttl}


def cache_delete(key: str):
    if _redis_available:
        try:
            _redis.delete(key)
            return
        except Exception:
            pass
    _memory_cache.pop(key, None)


def cache_delete_pattern(pattern: str):
    if _redis_available:
        try:
            keys = _redis.keys(pattern)
            if keys:
                _redis.delete(*keys)
            return
        except Exception:
            pass
    prefix = pattern.rstrip("*")
    for k in list(_memory_cache.keys()):
        if k.startswith(prefix):
            del _memory_cache[k]


def cached(ttl: int = 300):
    """Decorator for caching function results."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            cache_key = f"cache:{func.__name__}:{args}:{kwargs}"
            result = cache_get(cache_key)
            if result is not None:
                return json.loads(result)
            result = func(*args, **kwargs)
            cache_set(cache_key, json.dumps(result, default=str), ttl)
            return result
        return wrapper
    return decorator
