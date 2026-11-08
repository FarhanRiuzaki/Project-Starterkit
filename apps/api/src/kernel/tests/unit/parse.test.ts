import { describe, expect, it } from "bun:test";
import { firstValues, idParam, isUuid, queryValues } from "../../parse";

describe("firstValues", () => {
  it("keeps the first value of a repeated key and decodes values", () => {
    expect(firstValues("http://x/a?page=2&page=3&q=a%20b")).toEqual({ page: "2", q: "a b" });
    expect(firstValues("http://x/a")).toEqual({});
  });

  it("a __proto__ key is an own key, not the prototype", () => {
    const q = firstValues("http://x/a?__proto__=1");
    expect(Object.hasOwn(q, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(q)).toBe(Object.prototype);
  });
});

describe("queryValues", () => {
  it("preserves repeated selections without splitting commas or coercing JSON; scalar keys remain first-value", () => {
    expect(queryValues("http://x/?role=Design%2C%20Team&role=%E6%97%A5%E6%9C%AC&role=%5B%22Admin%22%5D&page=2&page=3", ["role"]))
      .toEqual({ role: ["Design, Team", "日本", '["Admin"]'], page: "2" });
    expect(queryValues("http://x/?role=Admin&status=active&status=inactive", ["role"]))
      .toEqual({ role: "Admin", status: "active" });
  });
  it("keeps prototype-like keys as own values even when explicitly allowed to repeat", () => {
    const q = queryValues("http://x/?__proto__=one&__proto__=two", ["__proto__"]);
    expect(Object.getPrototypeOf(q)).toBe(Object.prototype);
    expect(Object.hasOwn(q, "__proto__")).toBe(true);
    expect(q.__proto__).toEqual(["one", "two"]);
  });
});

describe("idParam", () => {
  it("a UUID passes in any letter case; anything else is 404 for the noun", () => {
    const id = Bun.randomUUIDv7();
    expect(idParam(id.toUpperCase(), "thing")).toBe(id.toUpperCase());
    for (const bad of ["abc", "1", `${id}x`, `${id} `, "", undefined]) {
      expect(() => idParam(bad, "thing")).toThrow("This thing doesn't exist or was deleted.");
    }
    expect(isUuid(id)).toBe(true);
  });
});
