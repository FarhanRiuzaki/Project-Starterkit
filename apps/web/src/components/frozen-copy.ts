/** Attributes that name or point at another element by id. */
const REFS = ["id", "for", "aria-labelledby", "aria-describedby", "aria-controls", "aria-owns", "aria-activedescendant", "aria-errormessage", "aria-details", "list", "form"];

/**
 * A static copy of the previous page stands next to the live page for a moment (route-skeleton.tsx): it must not
 * duplicate ids or point labels and ARIA references at elements of the live page, and its fields carry no name.
 * `els` = the copy's root and every element inside it.
 */
export function scrubCopy(els: Iterable<{ removeAttribute(name: string): void; matches(selector: string): boolean }>): void {
  for (const el of els) {
    for (const a of REFS) el.removeAttribute(a);
    if (el.matches("input, select, textarea, button")) el.removeAttribute("name");
  }
}
