import { config } from "../config";
import { log } from "../log";

export type Mail = { to: string; subject: string; text: string };

const outbox: Mail[] = [];

/**
 * Sends `m` without waiting (call it after the transaction commits). Transport `log`: one line with the masked
 * address and the subject, never the text (it holds links with tokens); under NODE_ENV=test the mail is also kept for
 * `sentMail()`. SMTP comes later (MAIL_TRANSPORT=smtp).
 */
export function sendMail(m: Mail): void {
  log.info({ to: m.to.replace(/^(.)[^@]*/, "$1***"), subject: m.subject }, "mail");
  if (config().NODE_ENV === "test") outbox.push(m);
}

/** Mails sent so far (tests only). */
export const sentMail = (): Mail[] => [...outbox];
export const clearMail = (): void => void outbox.splice(0);
