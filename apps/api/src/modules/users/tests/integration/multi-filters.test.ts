import { beforeEach, expect, it } from "bun:test";
import { call, resetData, signIn } from "../../../../../test/helpers/app";
import { eq } from "drizzle-orm";
import { db } from "../../../../kernel/db";
import { roles, userRoles } from "../../../rbac";
import { users } from "../../schema";

let token: string;
beforeEach(async () => { await resetData(); token = await signIn("superadmin"); });

it("keeps PostgreSQL's legacy Unicode case comparison and treats JSON-looking scalar roles literally", async () => {
  const [viewer] = await db.select({ id: users.id }).from(users).where(eq(users.username, "viewer"));
  for (const name of ["İstanbul", '["Admin"]']) {
    const id = Bun.randomUUIDv7();
    await db.insert(roles).values({ id, name });
    await db.insert(userRoles).values({ roleId: id, userId: viewer!.id });
    const response = await call("GET", `/v1/users?${new URLSearchParams({ role: name, q: "viewer@example.com" })}`, { token });
    expect(response.status).toBe(200);
    expect(((await response.json()) as { total: number }).total).toBe(1);
  }
});

it("role OR, status OR and search AND share the full matching set with bulk, including comma/Unicode roles", async () => {
  const roles = ["Design, Team", "日本チーム"];
  for (const name of roles) expect((await call("POST", "/v1/roles", { token, body: { name, permissions: ["user.view"] } })).status).toBe(201);
  const created: string[] = [];
  for (let i = 0; i < 18; i++) {
    const response = await call("POST", "/v1/users", { token, body: {
      name: `Multi filter ${i}`, username: `multi.${i}`, email: `multi.${i}@example.com`,
      isLdap: true, isActive: i % 2 === 0, roles: i === 0 ? roles : [roles[i % 2]!],
    } });
    expect(response.status).toBe(201);
    created.push(((await response.json()) as { id: string }).id);
  }
  const query = new URLSearchParams({ q: "Multi filter" });
  roles.forEach(role => query.append("role", role));
  query.append("status", "active"); query.append("status", "inactive");
  const response = await call("GET", `/v1/users?${query}`, { token });
  expect(response.status).toBe(200);
  const page = (await response.json()) as { total: number; items: { id: string }[] };
  expect(page.total).toBe(18);
  expect(page.items).toHaveLength(15);
  expect(new Set(page.items.map((item: { id: string }) => item.id)).size).toBe(15);
  const single = await call("GET", `/v1/users?${new URLSearchParams({ role: "design, team", q: "Multi filter" })}`, { token });
  expect(((await single.json()) as { total: number }).total).toBe(9);
  const bulk = await call("POST", "/v1/users/bulk", { token, body: {
    action: "delete", filter: { q: "Multi filter", role: roles, status: ["active", "inactive"] },
  } });
  expect(bulk.status).toBe(200);
  const result = (await bulk.json()) as { done: string[]; skipped: unknown[] };
  expect(result.done.sort()).toEqual(created.sort());
  expect(result.skipped).toEqual([]);
  expect(((await (await call("GET", `/v1/users?${query}`, { token })).json()) as { total: number }).total).toBe(0);
});

it("query arrays reject every invalid element and more than 50 raw values before guard; bulk rejects nested arrays", async () => {
  for (const query of ["status=active&status=invalid", "role=Admin&role=", Array(51).fill("role=Admin").join("&")]) {
    expect((await call("GET", `/v1/users?${query}`)).status).toBe(400);
  }
  for (const role of [[["Admin"]], [1], Array(51).fill("Admin")]) {
    expect((await call("POST", "/v1/users/bulk", { token, body: { action: "delete", filter: { role } } })).status).toBe(400);
  }
  expect((await call("POST", "/v1/users/bulk", { token, body: { action: "assignRole", ids: ["unused"], role: ["Admin"] } })).status).toBe(400);
});
