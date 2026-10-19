import { describe, expect, it } from "vitest";
import { validateActionInput, validateConfirmText } from "./action-input";

const reasons = ["Service not responding", "Developer request"] as const;
const ok = { reason: "Developer request", note: "Requested via ticket.", ticket: "", confirm: "" };

describe("validateActionInput", () => {
  it("alasan wajib dari daftar", () => {
    expect(validateActionInput({ ...ok, reason: "" }, { reasons }).reason).toBe("Select a reason.");
    expect(validateActionInput({ ...ok, reason: "other" }, { reasons }).reason).toBe("Select a reason.");
  });
  it("catatan 10–500 karakter", () => {
    expect(validateActionInput({ ...ok, note: "short" }, { reasons }).note).toBe("Enter an audit note of at least 10 characters.");
    expect(validateActionInput({ ...ok, note: "x".repeat(501) }, { reasons }).note).toBe("Shorten the audit note to 500 characters or fewer.");
  });
  it("catatan menolak karakter kontrol selain baris baru", () => {
    expect(validateActionInput({ ...ok, note: "Requested\tvia ticket." }, { reasons }).note).toMatch(/^Remove tabs/);
    expect(validateActionInput({ ...ok, note: "Requested\nvia ticket." }, { reasons })).toEqual({});
  });
  it("tiket opsional, maksimal 20 karakter tanpa karakter kontrol", () => {
    expect(validateActionInput({ ...ok, ticket: "x".repeat(21) }, { reasons }).ticket).toMatch(/^Enter a ticket reference/);
    expect(validateActionInput({ ...ok, ticket: "REF-2026-0418" }, { reasons })).toEqual({});
  });
  it("konfirmasi ketik nama untuk aksi berdampak luas", () => {
    expect(validateActionInput(ok, { reasons, confirmText: "ws-21040117" }).confirm).toBe("Type ws-21040117 to continue.");
    expect(validateActionInput({ ...ok, confirm: "ws-21040117" }, { reasons, confirmText: "ws-21040117" })).toEqual({});
  });
});

describe("validateConfirmText (self-service confirmations without audit fields)", () => {
  it("checks only the typed confirmation", () => {
    expect(validateConfirmText({ confirm: " 20101061 " }, "20101061")).toEqual({});
    expect(validateConfirmText({ confirm: "2010106" }, "20101061")).toEqual({ confirm: "Type 20101061 to continue." });
    expect(validateConfirmText({ confirm: "" })).toEqual({});
  });
});
