import { createTransport, type Transporter } from "nodemailer";
import { config } from "./config";
import { log } from "./log";

export type Mail = { to: string; subject: string; text: string };

const outbox: Mail[] = [];

/** `rina@example.com` → `r***@example.com`: the only form of an address a log line carries. */
const masked = (to: string) => to.replace(/^(.)[^@]*/, "$1***");

/** An SMTP transport for `url` (smtp:// or smtps://, credentials in the URL) that gives up after 10 s at every step. */
export const smtpTransport = (url: string): Transporter =>
  createTransport({ url, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 10_000, dnsTimeout: 10_000 });

type Smtp = { transport: Transporter; from: string };
let smtp: Smtp | undefined;

/**
 * Sends `m` from `via.from` (MAIL_FROM through SMTP_URL by default). Logs one line with the masked address and the
 * subject; a failure logs only the error's name and code, since SMTP errors and replies quote the address.
 */
export async function deliver(m: Mail, via: Smtp = (smtp ??= { transport: smtpTransport(config().SMTP_URL!), from: config().MAIL_FROM! })): Promise<void> {
  const line = { to: masked(m.to), subject: m.subject };
  try {
    await via.transport.sendMail({ from: via.from, to: m.to, subject: m.subject, text: m.text });
    log.info(line, "mail");
  } catch (e) {
    log.error({ ...line, err: { name: e instanceof Error ? e.name : typeof e, code: (e as { code?: unknown } | null)?.code } }, "mail failed");
  }
}

/**
 * Sends `m` without waiting (call it after the transaction commits). Transport `smtp`: `deliver`. Transport `log`: one
 * line with the masked address and the subject, never the text (it holds links with tokens); under NODE_ENV=test the
 * mail is also kept for `sentMail()`.
 */
export function sendMail(m: Mail): void {
  if (config().MAIL_TRANSPORT === "smtp") return void deliver(m);
  log.info({ to: masked(m.to), subject: m.subject }, "mail");
  if (config().NODE_ENV === "test") outbox.push(m);
}

/** Mails sent so far (tests only). */
export const sentMail = (): Mail[] => [...outbox];
export const clearMail = (): void => void outbox.splice(0);
