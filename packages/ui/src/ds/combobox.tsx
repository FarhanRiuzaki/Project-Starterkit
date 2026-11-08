"use client";

import type { ComponentProps } from "react";
import { CommandCombobox } from "./combobox-command";
import { SearchCombobox } from "./combobox-search";
export { filterOptions, nextEnabled, type ComboOption } from "./combobox-search";

/** Retain both established selection contracts while sharing one public component. */
export function Combobox(props: ComponentProps<typeof CommandCombobox> | ComponentProps<typeof SearchCombobox>) {
  return "onValueChange" in props ? <CommandCombobox {...props} /> : <SearchCombobox {...props} />;
}
