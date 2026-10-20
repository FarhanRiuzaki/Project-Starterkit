import { afterEach, expect, it, spyOn } from "bun:test";
import { log } from "../../log";
import { clearMail, deliver, sendMail, sentMail, smtpTransport } from "../../mailer";

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

type Conn = { buf: string; inData: boolean };

/**
 * A minimal SMTP server on a free port: `rcpt` is its answer to RCPT TO. Collects the commands and the DATA lines of
 * every message.
 */
function fakeSmtp(rcpt = "250 ok") {
  const got = { commands: [] as string[], data: [] as string[] };
  const server = Bun.listen<Conn>({
    hostname: "127.0.0.1",
    port: 0,
    socket: {
      open(s) {
        s.data = { buf: "", inData: false };
        s.write("220 fake ESMTP\r\n");
      },
      data(s, chunk) {
        s.data.buf += chunk.toString();
        for (let i; (i = s.data.buf.indexOf("\r\n")) >= 0;) {
          const line = s.data.buf.slice(0, i);
          s.data.buf = s.data.buf.slice(i + 2);
          if (s.data.inData) {
            if (line === ".") {
              s.data.inData = false;
              s.write("250 queued\r\n");
            } else got.data.push(line);
            continue;
          }
          got.commands.push(line);
          const cmd = line.slice(0, 4).toUpperCase();
          s.data.inData = cmd === "DATA";
          s.write(cmd === "RCPT" ? `${rcpt}\r\n` : cmd === "DATA" ? "354 go on\r\n" : cmd === "QUIT" ? "221 bye\r\n" : "250 ok\r\n");
        }
      },
    },
  });
  return { url: `smtp://127.0.0.1:${server.port}`, got, stop: () => server.stop(true) };
}

let stop = () => {};
afterEach(() => stop());

it("smtp transport sends from MAIL_FROM to the address with the subject and the text", async () => {
  const smtp = fakeSmtp();
  stop = smtp.stop;
  await deliver({ to: "rina@example.com", subject: "Reset your password", text: "Open https://app/reset?token=abc" },
    { transport: smtpTransport(smtp.url), from: "Starterkit <noreply@example.test>" });
  expect(smtp.got.commands).toContain("MAIL FROM:<noreply@example.test>");
  expect(smtp.got.commands).toContain("RCPT TO:<rina@example.com>");
  expect(smtp.got.data).toContain("From: Starterkit <noreply@example.test>");
  expect(smtp.got.data).toContain("To: rina@example.com");
  expect(smtp.got.data).toContain("Subject: Reset your password");
  expect(smtp.got.data.join("\n")).toContain("Content-Type: text/plain");
  expect(smtp.got.data.at(-1)).toBe("Open https://app/reset?token=abc");
});

it("smtp transport gives up after 10 s at every step (connect, greeting, idle socket, DNS)", () => {
  const { options } = smtpTransport("smtp://user:pass@mail.example.test:587");
  expect(options).toMatchObject({ host: "mail.example.test", port: 587, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 10_000, dnsTimeout: 10_000 });
});

it("smtp transport takes TLS from the URL: smtps:// is TLS from the start, ?requireTLS=true demands STARTTLS", () => {
  expect(smtpTransport("smtps://mail.example.test").options).toMatchObject({ secure: true });
  expect(smtpTransport("smtp://mail.example.test:587?requireTLS=true").options).toMatchObject({ secure: false, requireTLS: true });
});

it("a refused mail logs the masked address and the error's name and code, never the address, the text or the server's reply", async () => {
  const smtp = fakeSmtp("550 5.1.1 <rina@example.com>: mailbox unavailable");
  stop = smtp.stop;
  const spy = spyOn(log, "error");
  try {
    await deliver({ to: "rina@example.com", subject: "Reset your password", text: "https://app/reset?token=abc" },
      { transport: smtpTransport(smtp.url), from: "noreply@example.test" });
    expect(spy).toHaveBeenCalledTimes(1);
    const [fields, msg] = spy.mock.calls[0] as unknown as [Record<string, unknown>, string];
    expect(msg).toBe("mail failed");
    expect(fields).toEqual({ to: "r***@example.com", subject: "Reset your password", err: { name: "Error", code: "EENVELOPE" } });
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(/rina@|token=abc|mailbox unavailable/);
  } finally {
    spy.mockRestore();
  }
});
