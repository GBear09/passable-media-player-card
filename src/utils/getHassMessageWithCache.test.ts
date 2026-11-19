import {
  getHassMessageWithCache,
  clearHassMessageCache,
  getHassMessageCache,
} from "./getHassMessageWithCache";

// Mock getHass and hass.connection.sendMessagePromise
let callCounter = 0;
jest.mock("./getHass", () => ({
  getHass: () => ({
    connection: {
      sendMessagePromise: jest.fn(async msg => {
        callCounter++;
        return {
          result: `response-for-${JSON.stringify(msg)}-call-${callCounter}`,
        };
      }),
    },
  }),
}));

describe("getHassMessageWithCache", () => {
  beforeEach(() => {
    clearHassMessageCache();
    jest.clearAllMocks();
    callCounter = 0;
  });

  it("returns a response and caches it", async () => {
    const message = { type: "test", foo: 1 };
    const result1 = await getHassMessageWithCache(message);
    const result2 = await getHassMessageWithCache(message);
    expect(result1).toEqual(result2);
    const cacheKey = JSON.stringify(message);
    expect(getHassMessageCache()[cacheKey]).toEqual(result1);
  });

  it("respects forceRefresh option", async () => {
    const message = { type: "refresh", bar: 2 };
    const result1 = await getHassMessageWithCache(message);
    const result2 = await getHassMessageWithCache(message, {
      forceRefresh: true,
    });
    expect(result1).not.toEqual(result2);
  });

  it("respects staleTime option", async () => {
    const message = { type: "stale", baz: 3 };
    const result1 = await getHassMessageWithCache(message, { staleTime: 10 });
    // Wait for cache to become stale
    await new Promise(res => setTimeout(res, 20));
    const result2 = await getHassMessageWithCache(message, { staleTime: 10 });
    expect(result1).not.toEqual(result2);
  });

  it("returns cached value if not stale", async () => {
    const message = { type: "fresh", qux: 4 };
    const result1 = await getHassMessageWithCache(message, { staleTime: 1000 });
    const result2 = await getHassMessageWithCache(message, { staleTime: 1000 });
    expect(result1).toEqual(result2);
  });

  it("can clear cache by key", async () => {
    const key = "clear-key";
    const message = { type: "clear", val: 5 };
    await getHassMessageWithCache(message);
    clearHassMessageCache(key);
    expect(getHassMessageCache()[key]).toBeUndefined();
  });

  it("can clear all cache", async () => {
    await getHassMessageWithCache({ type: "a" });
    await getHassMessageWithCache({ type: "b" });
    clearHassMessageCache();
    expect(Object.keys(getHassMessageCache())).toHaveLength(0);
  });

  it("deduplicates concurrent in-flight calls for the same message", async () => {
    const msg = { type: "inflight", id: 1 };
    const [r1, r2] = await Promise.all([
      getHassMessageWithCache(msg),
      getHassMessageWithCache(msg),
    ]);
    expect(r1).toEqual(r2);
    expect(callCounter).toBe(1);
  });

  it("evicts oldest entries when cache exceeds maximum size", async () => {
    for (let i = 0; i < 105; i++) {
      await getHassMessageWithCache({ type: "evict", index: i });
    }
    const keys = Object.keys(getHassMessageCache());
    expect(keys).toHaveLength(100);
    expect(keys).not.toContain(JSON.stringify({ type: "evict", index: 0 }));
    expect(keys).toContain(JSON.stringify({ type: "evict", index: 104 }));
  });
});
