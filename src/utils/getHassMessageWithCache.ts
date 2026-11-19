import { getHass } from "./getHass";
import type { MessageBase } from "home-assistant-js-websocket";

type HassCacheEntry<T = unknown> = {
  value: T;
  timestamp: number;
  staleTime: number;
};

const MAX_CACHE_ENTRIES = 100;

// A plain cache for request/response pairs with staleTime
let _hassCache: Record<string, HassCacheEntry<unknown>> = {};
const _inFlight = new Map<string, Promise<unknown>>();

function setCacheEntry(key: string, entry: HassCacheEntry<unknown>) {
  // Refresh insertion order on update and evict oldest entries past cap
  if (key in _hassCache) {
    const { [key]: _, ...rest } = _hassCache;
    _hassCache = { ...rest, [key]: entry };
  } else {
    _hassCache = { ..._hassCache, [key]: entry };
  }

  const keys = Object.keys(_hassCache);
  if (keys.length > MAX_CACHE_ENTRIES) {
    const excess = keys.length - MAX_CACHE_ENTRIES;
    const trimmed: Record<string, HassCacheEntry<unknown>> = {};
    for (let i = excess; i < keys.length; i++) {
      trimmed[keys[i]] = _hassCache[keys[i]];
    }
    _hassCache = trimmed;
  }
}

/**
 * Generic function to send a message via hass.connection.sendMessagePromise with caching
 * and in-flight request deduplication.
 * @param message The message object to send
 * @param options Optional: { forceRefresh: boolean, staleTime: number (ms) }
 * @returns Promise resolving to the response
 */
export async function getHassMessageWithCache<T = unknown>(
  message: MessageBase,
  options?: { forceRefresh?: boolean; staleTime?: number }
): Promise<T> {
  const key = JSON.stringify(message);
  const staleTime = options?.staleTime ?? 10000; // default 10s
  const entry = _hassCache[key] as HassCacheEntry<T> | undefined;
  const now = Date.now();
  if (
    !options?.forceRefresh &&
    entry &&
    now - entry.timestamp < entry.staleTime
  ) {
    return entry.value;
  }

  if (!options?.forceRefresh) {
    const pending = _inFlight.get(key);
    if (pending) {
      return pending as Promise<T>;
    }
  }

  const hass = getHass();
  if (!hass?.connection?.sendMessagePromise) {
    return Promise.reject(new Error("Home Assistant connection unavailable"));
  }

  const promise = (
    hass.connection.sendMessagePromise({
      ...message,
    }) as Promise<T>
  )
    .then(response => {
      setCacheEntry(key, {
        value: response,
        timestamp: Date.now(),
        staleTime,
      });
      return response;
    })
    .finally(() => {
      if (_inFlight.get(key) === promise) {
        _inFlight.delete(key);
      }
    });

  if (!options?.forceRefresh) {
    _inFlight.set(key, promise);
  }

  return promise;
}

/**
 * Clear the hass message cache (all or by key)
 * @param key Optional cache key to clear
 */
export function clearHassMessageCache(key?: string) {
  if (key) {
    const { [key]: _, ...rest } = _hassCache;
    _hassCache = rest;
    _inFlight.delete(key);
  } else {
    _hassCache = {};
    _inFlight.clear();
  }
}

/**
 * Access the current cache (readonly, returns values only)
 */
export function getHassMessageCache() {
  return Object.fromEntries(
    Object.entries(_hassCache).map(([k, v]) => [k, v.value])
  ) as Record<string, unknown>;
}
