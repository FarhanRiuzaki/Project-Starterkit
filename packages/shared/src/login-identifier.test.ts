import { expect, it } from "vitest";
import { LoginBody } from "./contracts/auth";
import { loginIdentifierBadge } from "./login-identifier";

it("identifies NIP without converting or dropping leading zeroes, with no account lookup", () => {
  expect(loginIdentifierBadge("22020283")).toBe("LDAP");
  expect(loginIdentifierBadge(" 00220283 ")).toBe("LDAP");
  expect(loginIdentifierBadge("person@example.com")).toBe("Email");
  expect(loginIdentifierBadge("22020283@example.com")).toBe("Email");
  expect(loginIdentifierBadge("alex.morgan")).toBe("Username");
  expect(loginIdentifierBadge("22alex")).toBe("Username");
  expect(loginIdentifierBadge("  ")).toBeNull();
});

it("defaults credential selection to auto while retaining explicit API methods", () => {
  const credentials = { login: "22020283", password: "example" };
  expect(LoginBody.parse(credentials).method).toBe("auto");
  for (const method of ["auto", "password", "ldap"] as const) expect(LoginBody.parse({ ...credentials, method }).method).toBe(method);
  expect(LoginBody.safeParse({ ...credentials, method: "unknown" }).success).toBe(false);
});
