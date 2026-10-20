import { forward } from "@/lib/server/forward";

/** Every /api/* path without a route of its own goes to the API at /v1/* (lib/server/forward.ts). */
export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const PUT = forward;
export const DELETE = forward;
