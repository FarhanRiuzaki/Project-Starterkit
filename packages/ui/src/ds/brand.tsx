import { cn } from "../lib/cn";

/** Placeholder brand mark: a square monogram (first letter of `name`) + the name. Replace per product. */
export function Brand({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-title-3 text-fg", className)}>
      <span aria-hidden="true" className="grid size-6 place-items-center rounded-md bg-primary text-label text-primary-foreground">
        {name.trim().charAt(0).toUpperCase()}
      </span>
      {name}
    </span>
  );
}
