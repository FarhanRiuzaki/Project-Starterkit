import { Icon } from "../ui/icon";
import { FailedIcon } from "../ui/icons";

/**
 * Error summary (GOV.UK pattern) at the top of a form after a failed submit: "There is a problem" with every error as a
 * link that moves focus to its field (`#${idPrefix}-${field}`). role="alert", so it is announced when it appears; the
 * fields keep their own messages (Field `error`). Renders nothing without errors.
 */
export function ErrorSummary({ errors, idPrefix, labels, title = "There is a problem" }: {
  errors: Partial<Record<string, string>>; idPrefix: string; labels?: Record<string, string>; title?: string;
}) {
  const list = Object.entries(errors).filter((e): e is [string, string] => !!e[1]);
  if (!list.length) return null;
  return (
    <div role="alert" className="grid gap-2 rounded-lg border border-down-mark/40 bg-down-soft px-4 py-3 text-body-sm">
      <p className="flex items-center gap-2 font-medium text-down-ink"><Icon icon={FailedIcon} className="size-4 shrink-0" />{title}</p>
      <ul className="grid gap-1 pl-6">
        {list.map(([k, m]) => (
          <li key={k}>
            <a href={`#${idPrefix}-${k}`} className="text-down-ink underline underline-offset-4 hover:decoration-2"
              onClick={(e) => { e.preventDefault(); document.getElementById(`${idPrefix}-${k}`)?.focus(); }}>
              {labels?.[k] ? `${labels[k]}: ` : ""}{m}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
