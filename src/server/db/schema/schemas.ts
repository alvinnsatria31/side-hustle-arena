import { pgSchema } from "drizzle-orm/pg-core";

export const identity = pgSchema("identity");
export const arena = pgSchema("arena");
export const rewards = pgSchema("rewards");
export const notifications = pgSchema("notifications");
export const automation = pgSchema("automation");
export const audit = pgSchema("audit");
export const ops = pgSchema("ops");
