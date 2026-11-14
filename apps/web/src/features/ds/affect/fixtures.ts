/**
 * Sample values for the Color Picker demo. A colour picker's value is a hex string, so these are data, not styling;
 * they live here because a `.tsx` file holds no colour literal (architecture test).
 */
export const PICKER = {
  accent: "#2f6bff",
  presets: [{ value: "#e5484d", label: "Red" }, { value: "#30a46c", label: "Green" }],
  translucent: "#8e4ec699",
} as const;
