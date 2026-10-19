export type ActionInput = { reason: string; note: string; ticket: string; confirm: string };

const NOTE_MIN = 10, NOTE_MAX = 500, TICKET_MAX = 20;
const CONTROL = /[\u0000-\u001f]/;
const CONTROL_BUT_NEWLINE = /[\u0000-\u0009\u000b-\u001f]/;
/** Length in code points ("🙂" is 1, not 2). */
const codePoints = (s: string) => [...s].length;

export const NOTE_CONTROL_TEXT = "Remove tabs and other control characters from the audit note. Line breaks are fine.";
export const TICKET_TEXT = "Enter a ticket reference of 20 characters or fewer, without control characters.";

/** Admin action form: the reason comes from a fixed list, the note is 10–500 characters, the ticket is optional. Messages say how to fix the field. */
export function validateActionInput(v: ActionInput, opts: { reasons: readonly string[]; confirmText?: string }) {
  const e: Partial<Record<keyof ActionInput, string>> = {};
  if (!opts.reasons.includes(v.reason)) e.reason = "Select a reason.";
  const note = v.note.trim();
  const n = codePoints(note);
  if (n < NOTE_MIN) e.note = "Enter an audit note of at least 10 characters.";
  else if (n > NOTE_MAX) e.note = "Shorten the audit note to 500 characters or fewer.";
  else if (CONTROL_BUT_NEWLINE.test(note)) e.note = NOTE_CONTROL_TEXT;
  const ticket = v.ticket.trim();
  if (codePoints(ticket) > TICKET_MAX || CONTROL.test(ticket)) e.ticket = TICKET_TEXT;
  if (opts.confirmText && v.confirm.trim() !== opts.confirmText) e.confirm = `Type ${opts.confirmText} to continue.`;
  return e;
}

/** Self-service confirmations (no admin audit fields, e.g. Change MFA device): only the typed confirmation. */
export function validateConfirmText(v: Pick<ActionInput, "confirm">, confirmText?: string) {
  const e: Partial<Record<keyof ActionInput, string>> = {};
  if (confirmText && v.confirm.trim() !== confirmText) e.confirm = `Type ${confirmText} to continue.`;
  return e;
}
