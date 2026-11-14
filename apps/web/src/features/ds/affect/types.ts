import type { ComponentType } from "react";

/** One vendored affectUI item in the gallery: `slug` is its file in packages/ui/src/affect. */
export type AffectDemo = {
  slug: string;
  /** Upstream's name, as its docs print it ("Tool Call Card"). */
  name: string;
  /** Renders the item with fictional sample data; owns whatever state the item needs. */
  Demo: ComponentType;
  /** Takes the full row instead of one grid column (screens, wide scenes). */
  wide?: boolean;
};
