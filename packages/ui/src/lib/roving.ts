/** Indeks tujuan untuk navigasi keyboard roving-tabindex; null jika tombol tidak relevan. */
export function nextIndex(current: number, key: string, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowRight":
    case "ArrowDown": return (current + 1) % count;
    case "ArrowLeft":
    case "ArrowUp": return (current - 1 + count) % count;
    case "Home": return 0;
    case "End": return count - 1;
    default: return null;
  }
}
