import { customType } from "drizzle-orm/pg-core";

/** `bytea` as a Buffer (token hashes). Drizzle has no built-in bytea column. */
export const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

/**
 * `jsonb` handed to the driver as a value: Bun SQL encodes a jsonb parameter itself, so Drizzle's own jsonb (which
 * stringifies first) would store a JSON string of the text. Reads come back already parsed; a stored string stays one.
 */
export const jsonb = customType<{ data: unknown; driverData: unknown }>({
  dataType: () => "jsonb",
  toDriver: (v) => v,
  fromDriver: (v) => v,
});
