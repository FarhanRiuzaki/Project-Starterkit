import { describe, expect, it } from "bun:test";
import { firstValues, idParam, isUuid } from "../../parse";

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
