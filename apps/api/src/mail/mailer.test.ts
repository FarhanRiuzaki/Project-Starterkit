import { expect, it, spyOn } from "bun:test";
import { log } from "../log";
import { clearMail, sendMail, sentMail } from "./mailer";

it("log transport writes one line without the address or the text, and keeps the mail for tests", () => {
  clearMail();
  const spy = spyOn(log, "info");
  try {
    sendMail({ to: "rina@example.com", subject: "Reset your password", text: "https://app/reset?token=abc" });
    expect(spy).toHaveBeenCalledTimes(1);
    const line = JSON.stringify(spy.mock.calls[0]);
    expect(line).toContain("Reset your password");
    expect(line).not.toMatch(/rina@|token=abc/);
  } finally {
    spy.mockRestore();
  }
  expect(sentMail()).toEqual([{ to: "rina@example.com", subject: "Reset your password", text: "https://app/reset?token=abc" }]);
  clearMail();
  expect(sentMail()).toEqual([]);
});
