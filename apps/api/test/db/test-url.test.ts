import { describe, expect, it } from "bun:test";
import { testDatabaseUrl } from "../helpers/test-url";

describe("the test database URL (test/helpers/preload.ts)", () => {
  it("is DATABASE_URL with _test appended, or TEST_DATABASE_URL when its name ends in _test", () => {
    expect(testDatabaseUrl({ DATABASE_URL: "postgresql://u:p@localhost:5432/app" })).toBe("postgresql://u:p@localhost:5432/app_test");
    expect(testDatabaseUrl({ DATABASE_URL: "postgresql://u:p@localhost:5432/app_test" })).toBe("postgresql://u:p@localhost:5432/app_test");
    expect(testDatabaseUrl({ TEST_DATABASE_URL: "postgresql://u:p@ci:5432/ci_test", DATABASE_URL: "postgresql://u:p@localhost:5432/app" }))
      .toBe("postgresql://u:p@ci:5432/ci_test");
  });

  it("refuses a TEST_DATABASE_URL whose database name doesn't end in _test (the tests truncate every table)", () => {
    expect(() => testDatabaseUrl({ TEST_DATABASE_URL: "postgresql://u:p@localhost:5432/app" })).toThrow("must end in _test");
    expect(() => testDatabaseUrl({})).toThrow("TEST_DATABASE_URL");
  });
});
