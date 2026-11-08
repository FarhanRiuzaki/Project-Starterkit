import { describe, expect, it } from "vitest";
import { firstError, rules, validateAll } from "./validate";

describe("validation rules", () => {
  it("required: empty text, whitespace, empty list, null and false (an unticked box) fail; anything else passes", () => {
    const r = rules.required("Enter your name.");
    for (const v of ["", "   ", [], null, undefined, false]) expect(r(v, {})).toBe("Enter your name.");
    for (const v of ["a", ["x"], 0, true]) expect(r(v, {})).toBeNull();
  });
  it("length, pattern and email only judge a value that is there (required says when it must be)", () => {
    expect(rules.minLength(3)("ab", {})).toBe("Use at least 3 characters.");
    expect(rules.minLength(3)("", {})).toBeNull();
    expect(rules.maxLength(5)("abcdef", {})).toBe("Use 5 characters or fewer.");
    expect(rules.email()("rina@example", {})).toBe("Enter an email address like name@example.com.");
    expect(rules.email()(" rina@example.com ", {})).toBeNull();
    expect(rules.pattern(/^\d+$/, "Use digits only.")("12a", {})).toBe("Use digits only.");
  });
  it("numbers: min and max on numbers or numeric text", () => {
    expect(rules.min(1)("0", {})).toBe("Enter 1 or more.");
    expect(rules.max(10)(11, {})).toBe("Enter 10 or less.");
    expect(rules.min(1)("", {})).toBeNull();
  });
  it("matches compares with another field of the same form", () => {
    expect(rules.matches("password", "The two passwords don't match.")("abc", { password: "abd" })).toBe("The two passwords don't match.");
    expect(rules.matches("password")("abc", { password: "abc" })).toBeNull();
  });
});

describe("validateAll / firstError", () => {
  const schema = { name: [rules.required("Enter a name.")], email: [rules.required("Enter an email."), rules.email()] };
  it("runs each field's rules in order and keeps the first message per field", () => {
    expect(validateAll({ name: "", email: "x" }, schema)).toEqual({ name: "Enter a name.", email: "Enter an email address like name@example.com." });
    expect(validateAll({ name: "Rina", email: "rina@example.com" }, schema)).toEqual({});
  });
  it("firstError follows the schema's field order, not the order errors were found", () => {
    expect(firstError({ email: "e", name: "n" }, schema)).toBe("name");
    expect(firstError({}, schema)).toBeNull();
  });
});
