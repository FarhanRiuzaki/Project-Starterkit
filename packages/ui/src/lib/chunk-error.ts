/**
 * A code chunk that failed to load: typically its file is gone because a newer version was deployed while the page
 * was open. Trying again asks for the same missing file, so only a full reload helps.
 */
export function isChunkError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return e.name === "ChunkLoadError" || /loading (css )?chunk|failed to load chunk|dynamically imported module|importing a module script failed/i.test(e.message);
}
