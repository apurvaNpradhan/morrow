import { sql } from "drizzle-orm";
import { customType } from "drizzle-orm/pg-core";

export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/**
 * Default for `timestamp` (without time zone) columns, which hold UTC. A bare
 * `now()` is cast through the session time zone, so a server not running in
 * UTC would store shifted times. Not for `withTimezone` columns.
 */
export const utcNow = sql`(now() AT TIME ZONE 'utc')`;
