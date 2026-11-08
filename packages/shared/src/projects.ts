// Project limits shared by the contract (zod, server) and the screens' form rules (no zod in client bundles).

export const PROJECT_STATUSES = ["active", "archived"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
/** Longest name and description a project takes. */
export const PROJECT_NAME_MAX = 100;
export const PROJECT_DESCRIPTION_MAX = 500;
