import { describe, expect, it } from "vitest";
import { describeFailure, staleText } from "./failure";

describe("describeFailure", () => {
  it("separates why, next step and raw detail", () => {
    const r = describeFailure({ status: 502, message: "boom." }, "The API", "Try again in a minute.");
    expect(r).toEqual({ why: "The API returned an error.", cause: "The API returned an error. Try again in a minute.", detail: "boom" });
    expect(describeFailure(new TypeError("Failed to fetch"), "The API").why).toBe("The app couldn't reach its server.");
  });
  it("accepts any thrown value: status-carrying error, string, null", () => {
    expect(describeFailure(Object.assign(new Error("upstream: timeout"), { status: 502 }), "The API").why).toBe("The API didn't respond in time.");
    expect(describeFailure("HTTP 500", "The API").detail).toBe("HTTP 500");
    expect(describeFailure(null, "The API").why).toBe("The app couldn't reach its server.");
    expect(describeFailure({ status: 404 }, "The API").why).toBe("The API couldn't find the requested record.");
  });
});

describe("staleText", () => {
  it("states age and source", () => {
    expect(staleText(Date.UTC(2026, 9, 16, 7, 2), "The API")).toMatch(/^Showing data from .*WIB\. The API isn't responding; values may be out of date\.$/);
  });
});
