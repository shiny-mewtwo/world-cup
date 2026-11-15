import { afterEach, describe, expect, it, vi } from "vitest";

import { consumeRateLimit } from "@/lib/rate-limit";

afterEach(() => {
  vi.useRealTimers();
});

describe("consumeRateLimit", () => {
  it("blocks requests after the configured limit", () => {
    const options = {
      key: "test:block-after-limit",
      limit: 2,
      windowMs: 1000,
    };

    expect(consumeRateLimit(options).allowed).toBe(true);
    expect(consumeRateLimit(options).allowed).toBe(true);
    expect(consumeRateLimit(options).allowed).toBe(false);
  });

  it("allows requests again after the window expires", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const options = {
      key: "test:reset-after-window",
      limit: 1,
      windowMs: 1000,
    };

    expect(consumeRateLimit(options).allowed).toBe(true);
    expect(consumeRateLimit(options).allowed).toBe(false);

    vi.setSystemTime(new Date("2026-01-01T00:00:01.001Z"));

    expect(consumeRateLimit(options).allowed).toBe(true);
  });
});
