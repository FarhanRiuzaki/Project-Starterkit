/** Key cap (spec §5.2): 20 px, radius 6, --tray, mono 11 fg-2. Decorative: the action keeps its own name. */
export function Kbd({ keys }: { keys: string[] }) {
  return (
    <span className="inline-flex gap-0.5" aria-hidden="true">
      {keys.map((k) => (
        <kbd key={k} className="inline-grid h-5 min-w-5 place-items-center rounded-sm border border-line bg-tray px-1.5 font-mono text-caption font-medium text-fg-2">{k}</kbd>
      ))}
    </span>
  );
}
