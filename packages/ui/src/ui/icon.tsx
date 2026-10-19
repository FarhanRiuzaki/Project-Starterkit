import { createElement, type ReactElement, type SVGProps } from "react";

/**
 * Icon data in the @hugeicons/core-free-icons shape (Stroke Rounded): a list of [tag, attributes] elements drawn
 * on a 24 × 24 grid with `stroke="currentColor"`. Plain data, so it also crosses the server → client boundary
 * as a prop. Take icons from `./icons` (one icon per meaning), never from the package directly.
 */
export type IconData = readonly (readonly [string, { readonly [key: string]: string | number }])[];

export type IconProps = Omit<SVGProps<SVGSVGElement>, "children" | "ref" | "strokeWidth"> & {
  icon: IconData;
  /** px, default 16 (spec §3.6); a `size-*` class on `className` wins in CSS. */
  size?: number;
  /** Default 1.5 everywhere (spec §3.6). Applies to stroked elements only; filled ones stay filled. */
  strokeWidth?: number;
};

/**
 * The drawn elements of one icon at one stroke width, built once and reused by every render (React elements are
 * immutable). Icons render in every row, chip and nav item, so this keeps the per-render cost at the <svg> itself.
 */
const drawn = new WeakMap<IconData, Map<number, ReactElement[]>>();
function elementsOf(icon: IconData, strokeWidth: number): ReactElement[] {
  let byWidth = drawn.get(icon);
  if (!byWidth) drawn.set(icon, (byWidth = new Map()));
  let els = byWidth.get(strokeWidth);
  if (!els) {
    els = icon.map(([tag, { key, ...attrs }], i) =>
      createElement(tag, { key: String(key ?? i), ...attrs, ...("strokeWidth" in attrs ? { strokeWidth } : null) }));
    byWidth.set(strokeWidth, els);
  }
  return els;
}

/**
 * Tiny local renderer for Hugeicons data (no @hugeicons/react). Server-component safe: no hooks, no client code.
 * Decorative by default (`aria-hidden`, not focusable); pass `aria-label` to make it a labelled image.
 * Colour is always `currentColor` — set it with a text token class on the icon or its parent.
 */
export function Icon({ icon, size = 16, strokeWidth = 1.5, className, ...rest }: IconProps) {
  const labelled = rest["aria-label"] != null || rest["aria-labelledby"] != null;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="none"
      className={className} focusable="false" {...(labelled ? { role: "img" } : { "aria-hidden": true })} {...rest}
    >
      {elementsOf(icon, strokeWidth)}
    </svg>
  );
}
