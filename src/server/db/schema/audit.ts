import { jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { auditActorType } from "./enums";
import { audit } from "./schemas";

export const logs = audit.table("logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorType: auditActorType("actor_type").notNull(),
  actorSubject: text("actor_subject"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  requestId: text("request_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
