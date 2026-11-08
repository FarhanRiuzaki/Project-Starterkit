/** Shared locale and cached number formatters, independent of the display helpers that use them. */
export const LOCALE = "en-GB";
export const nf0 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
export const nf1 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
