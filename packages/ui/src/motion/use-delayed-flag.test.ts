import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOADING } from "./tokens";
import { delayedFlag } from "./use-delayed-flag";

const DELAY = LOADING.delay * 1000;
const MIN = LOADING.minVisible * 1000;

describe("loading tokens (spec: no flicker)", () => {
  it("a loading state waits 150 ms and then stays at least 300 ms", () => {
    expect(LOADING).toEqual({ delay: 0.15, minVisible: 0.3 });
  });
});

describe("delayedFlag", () => {
  let seen: boolean[];
  let flag: ReturnType<typeof delayedFlag>;
  beforeEach(() => {
    vi.useFakeTimers();
    seen = [];
    flag = delayedFlag((v) => seen.push(v), LOADING);
  });
  afterEach(() => vi.useRealTimers());

  it("on for less than the delay → never shown", () => {
    flag.set(true);
    vi.advanceTimersByTime(DELAY - 1);
    flag.set(false);
    vi.advanceTimersByTime(5000);
    expect(seen).toEqual([]);
  });

  it("on past the delay → shown exactly at the delay", () => {
    flag.set(true);
    vi.advanceTimersByTime(DELAY - 1);
    expect(seen).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(seen).toEqual([true]);
  });

  it("once shown, stays at least minVisible even when loading ends at once", () => {
    flag.set(true);
    vi.advanceTimersByTime(DELAY + 10);
    flag.set(false);
    vi.advanceTimersByTime(MIN - 10 - 1);
    expect(seen).toEqual([true]);
    vi.advanceTimersByTime(1);
    expect(seen).toEqual([true, false]);
  });

  it("shown longer than minVisible → hides as soon as loading ends", () => {
    flag.set(true);
    vi.advanceTimersByTime(DELAY + MIN + 50);
    flag.set(false);
    expect(seen).toEqual([true, false]);
  });

  it("loading again during the minimum time keeps it shown without a blink", () => {
    flag.set(true);
    vi.advanceTimersByTime(DELAY);
    flag.set(false);
    vi.advanceTimersByTime(100);
    flag.set(true);
    vi.advanceTimersByTime(5000);
    expect(seen).toEqual([true]);
  });

  it("short on/off bursts each restart the delay and never show", () => {
    for (let i = 0; i < 5; i++) {
      flag.set(true);
      vi.advanceTimersByTime(DELAY - 20);
      flag.set(false);
      vi.advanceTimersByTime(20);
    }
    expect(seen).toEqual([]);
  });

  it("repeating the same value changes nothing (no restart of the delay)", () => {
    flag.set(true);
    vi.advanceTimersByTime(DELAY - 10);
    flag.set(true);
    vi.advanceTimersByTime(10);
    expect(seen).toEqual([true]);
  });

  it("dispose cancels a pending show or hide", () => {
    flag.set(true);
    flag.dispose();
    vi.advanceTimersByTime(5000);
    expect(seen).toEqual([]);
  });
});
