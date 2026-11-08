import { describe, expect, it } from "vitest";
import { timeRange, patchTimeSearch, refreshInterval, refreshScope } from "./time-controls";

describe("navbar time controls", () => {
  const now = Date.UTC(2026, 10, 7, 18);
  it("uses calendar days in the app zone and rejects invalid URL drafts", () => {
    expect(timeRange(new URLSearchParams("range=7d"), 14, now).range).toEqual({ from: "2026-11-02", to: "2026-11-08" });
    expect(timeRange(new URLSearchParams("from=2026-02-30&to=2026-03-01"), 14, now).custom).toBe(false);
  });
  it("range changes reset paging, preserve the table filters and sort", () => {
    expect(patchTimeSearch(new URLSearchParams("page=4&event=login_failed&sort=at&refresh=30"), { range: "30d", from: "", to: "" }).toString()).toBe("event=login_failed&sort=at&refresh=30&range=30d");
  });
  it("refresh does not reset paging, and only accepted intervals are scheduled", () => {
    expect(patchTimeSearch(new URLSearchParams("page=4"), { refresh: "10" }).get("page")).toBe("4");
    expect(refreshInterval("1")).toBe(0); expect(refreshInterval("30")).toBe(30);
  });
  it("pauses on forms and limits refresh to the owning module", () => {
    expect(refreshScope("/users/new")).toBeNull(); expect(refreshScope("/users/id/edit")).toBeNull();
    expect(refreshScope("/me")).toBeNull(); expect(refreshScope("/roles")).toBe("rbac");
    expect(refreshScope("/audit/auth")).toBe("audit");
  });
});
