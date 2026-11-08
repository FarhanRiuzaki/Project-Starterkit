import { describe, expect, it } from "vitest";
import { viewLink, viewQuery } from "./saved-views";

describe("saved views", () => {
  it("a view's query drops the page and sorts its keys, so the same view matches however the URL is spelled", () => {
    expect(viewQuery(new URLSearchParams("status=active&page=3&role=Admin"))).toBe("role=Admin&status=active");
    expect(viewQuery(new URLSearchParams("role=Admin&status=active"))).toBe(viewQuery(new URLSearchParams("status=active&role=Admin")));
    expect(viewQuery(new URLSearchParams(""))).toBe("");
  });
  it("a view opens on its own page; a stored query can't change the path", () => {
    expect(viewLink("/users", "status=inactive")).toBe("/users?status=inactive");
    expect(viewLink("/users", "")).toBe("/users");
    expect(viewLink("/users", "a=%2F%2Fevil.com#x")).toBe("/users?a=%2F%2Fevil.com%23x");
  });
});
