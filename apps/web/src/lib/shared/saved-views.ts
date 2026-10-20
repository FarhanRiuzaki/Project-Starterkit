/** A list's URL query as a saved view keeps it: without the page number, keys sorted, so two spellings of one view match. */
export function viewQuery(sp: URLSearchParams): string {
  const q = new URLSearchParams(sp);
  q.delete("page");
  q.sort();
  return q.toString();
}

/** Where a saved view opens: its list page with its query re-encoded, so a stored query can't change the path. */
export function viewLink(path: string, query: string): string {
  const q = viewQuery(new URLSearchParams(query)).toString();
  return q ? `${path}?${q}` : path;
}
