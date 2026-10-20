import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ageReauth } from "../../tests/e2e/helpers";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));

describe("ageReauth (tests/e2e/helpers.ts)", () => {
  const saved = process.env.E2E_DB;
  afterEach(() => {
    if (saved === undefined) delete process.env.E2E_DB;
    else process.env.E2E_DB = saved;
    vi.mocked(execFileSync).mockClear();
  });

  it("refuses a database whose name doesn't end in _e2e, before running anything", () => {
    for (const url of [undefined, "postgres://u:p@localhost:5432/starterkit", "postgres://u:p@localhost:5432/starterkit_e2e_old", "not a url"]) {
      if (url === undefined) delete process.env.E2E_DB;
      else process.env.E2E_DB = url;
      expect(() => ageReauth("viewer@example.com")).toThrow(/_e2e/);
    }
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it("runs against a database named *_e2e", () => {
    process.env.E2E_DB = "postgres://u:p@localhost:5432/starterkit_e2e";
    ageReauth("viewer@example.com");
    expect(execFileSync).toHaveBeenCalledTimes(1);
  });
});
