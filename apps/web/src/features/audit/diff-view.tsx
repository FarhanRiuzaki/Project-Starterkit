import { presentActivityChanges } from "@starterkit/shared/audit-changes";

/** One recorded change model for the responsive detail and CSV; secrets remain masked. */
export function DiffView({ action, before, after }: { action: string; before: unknown; after: unknown }) {
  const result = presentActivityChanges(action, before, after);
  return (
    <section aria-labelledby="diff-title" className="grid min-w-0 gap-2">
      <h3 id="diff-title" className="text-title-3 text-fg">{result.heading}</h3>
      {result.message ? <p className="text-body-sm text-fg-3">{result.message}</p> : (
        <dl className="min-w-0 overflow-hidden rounded-lg border border-line text-body-sm">
          {result.rows.map(row => (
            <div key={row.key} className="grid min-w-0 gap-2 border-b border-line p-3 last:border-b-0">
              <dt className="min-w-0 break-words text-label text-fg-2">{row.label}</dt>
              <dd className="min-w-0">
                {row.kind === "value" ? <p className="whitespace-pre-wrap break-words text-fg">{row.value}</p> : (
                  <dl className="grid min-w-0 gap-3 md:grid-cols-2">
                    <div className="grid min-w-0 content-start gap-1"><dt className="text-caption text-fg-3">Before</dt><dd className="min-w-0 whitespace-pre-wrap break-words text-fg-2">{row.before}</dd></div>
                    <div className="grid min-w-0 content-start gap-1"><dt className="text-caption text-fg-3">After</dt><dd className="min-w-0 whitespace-pre-wrap break-words text-fg">{row.after}</dd></div>
                  </dl>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
