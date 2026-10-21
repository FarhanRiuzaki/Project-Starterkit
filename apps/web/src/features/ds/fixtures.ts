import type { Health } from "@starterkit/ui/lib/status";

/** Deterministic, fictional sample data for the gallery (also the visual test baseline). */
type Point = [number, number];
const T0 = Date.UTC(2026, 9, 15, 17, 0) / 1000;
const hourly = (vals: number[]): Point[] => vals.map((v, i) => [T0 + i * 3600, v]);

export const REQUESTS_BY_SERVICE = [
  { label: "api", points: hourly([12, 9, 6, 4, 3, 3, 5, 14, 38, 62, 74, 81, 66, 72, 85, 90, 78, 64, 40, 28, 22, 18, 15, 13]) },
  { label: "web", points: hourly([5, 4, 3, 2, 2, 2, 3, 8, 18, 30, 41, 44, 36, 40, 47, 52, 44, 35, 22, 15, 11, 9, 7, 6]) },
  { label: "worker", points: hourly([2, 1, 1, 1, 0, 0, 1, 3, 9, 14, 20, 22, 19, 23, 25, 24, 21, 17, 10, 7, 5, 4, 3, 2]) },
];
export const BYTES_PER_HOUR = [{ label: "Bytes", points: hourly([42, 30, 22, 18, 15, 14, 20, 64, 180, 310, 388, 420, 350, 372, 440, 468, 402, 330, 210, 140, 108, 90, 74, 61].map((v) => v * 1000)) }];
export const DAYS = ["Thu 10", "Fri 11", "Sat 12", "Sun 13", "Mon 14", "Tue 15", "Wed 16"];
export const RESULTS = [
  { label: "Succeeded", values: [1840, 2120, 420, 380, 2410, 2290, 1960] },
  { label: "Failed", values: [62, 48, 9, 6, 88, 71, 37], tone: "down" as const },
];
export const TOP_ERRORS = [
  { label: "timeout", value: 412 }, { label: "bad_request", value: 287 }, { label: "forbidden", value: 96 },
  { label: "not_found", value: 41 }, { label: "duplicate", value: 23 },
  { label: "a-very-long-error-code-that-needs-to-be-truncated-in-the-row-label", value: 9 },
];
export const SPARK = [820, 900, 870, 1010, 960, 1100, 1080, 1150, 1190, 1210, 1240, 1284];
export const HEAT = [34, 12, null, 71, 8, 22, 56, 91, 44, 3, 18, 63, 27, 39, 5, 48, 82, 15, 0, 29, 67, 11, 36, 52]
  .map((v, i) => ({ id: `node-${i + 1}`, label: `node-${i + 1}`, value: v == null ? null : v / 100, valueText: v == null ? "No data" : `Load ${v}%` }));

export type Row = { id: string; name: string; email: string; status: Health; lastSeen: string; city: string };
const FIRST = ["Alex", "Sam", "Robin", "Jamie", "Taylor", "Morgan", "Casey", "Jordan", "Riley", "Avery"];
const LAST = ["Rivers", "Hale", "Lund", "Okafor", "Stone", "Quill", "Marsh", "Bell", "Cross", "Vale", "Ford", "Lane"];
const STATUS: Health[] = ["healthy", "healthy", "degraded", "stopped", "healthy", "down"];
const CITY = ["Berlin", "Lima", "Oslo", "Kyoto", "Accra", "Quito"];
/** 60 deterministic rows for the paged table example. */
export const ROWS: Row[] = Array.from({ length: 60 }, (_, i) => {
  const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`;
  return {
    id: `row-${i + 1}`, name, email: `${name.toLowerCase().replace(" ", ".")}.${i + 1}@example.com`, status: STATUS[i % STATUS.length]!,
    lastSeen: `${(i * 13) % 59 + 1} min ago`, city: CITY[(i * 5) % CITY.length]!,
  };
});

/** The permission matrix sample's rows: fixed, so a module added to the app doesn't change the gallery's screenshots. */
export const MATRIX_MODULES = [
  { key: "user", actions: ["view", "create", "edit", "delete"] },
  { key: "role", actions: ["view", "create", "edit", "delete"] },
  { key: "permission", actions: ["view", "create"] },
  { key: "audit", actions: ["view"] },
] as const;
