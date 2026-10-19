export function isClipped(el: { scrollWidth: number; clientWidth: number }): boolean {
  return el.scrollWidth > el.clientWidth;
}
