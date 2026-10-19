import { diffFields } from "@/lib/shared/audit";

/**
 * Before/after of an activity entry: field | before | after, changed fields only. Credential-named fields show
 * `••••` (the store never keeps those values either).
 */
export function DiffView({ before, after }: { before: unknown; after: unknown }) {
  const rows = diffFields(before, after);
  return (
    <section aria-labelledby="diff-title" className="grid gap-2">
      <h3 id="diff-title" className="text-title-3 text-fg">Changes</h3>
      {rows.length === 0 ? (
        <p className="text-body-sm text-fg-3">This action records no field values, only that it happened.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line">
          <table className="w-full table-fixed text-body-sm">
            <thead className="bg-tray text-left text-label text-fg-3">
              <tr><th scope="col" className="w-36 px-3 py-2 font-normal">Field</th><th scope="col" className="px-3 py-2 font-normal">Before</th><th scope="col" className="px-3 py-2 font-normal">After</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.field} className="border-t border-line align-top">
                  <th scope="row" className="px-3 py-2 text-left font-mono font-normal text-fg-2 break-words">{r.field}</th>
                  <td className="px-3 py-2 break-words text-fg-2">{r.before}</td>
                  <td className="px-3 py-2 break-words text-fg">{r.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
