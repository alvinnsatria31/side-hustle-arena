import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { cvScans, deliveries, events, users, workspaceProgress, enrollments } from "@/server/db/schema";
import { ArenaDomainError } from "@/server/arena/errors";
import { writeAudit } from "@/server/reviews/audit";

type Db = ReturnType<typeof getDb>;

/**
 * The two things a participant is entitled to decide about their own data:
 * whether it may be shown publicly, and whether their account should end.
 */

/**
 * Showcase consent, given and taken back by the participant themselves.
 *
 * Recorded with a timestamp and a source rather than as a boolean, so "did they
 * agree, and when" is answerable later — which is the whole point of consent
 * being auditable rather than merely stored.
 */
export async function setShowcaseConsent(input: {
  userId: string;
  consent: boolean;
  source?: string;
  now?: Date;
  db?: Db;
}): Promise<{ consented: boolean; consentedAt: Date | null }> {
  const db = input.db ?? getDb();
  const now = input.now ?? new Date();
  const [updated] = await db
    .update(users)
    .set({
      showcaseConsentAt: input.consent ? now : null,
      showcaseConsentSource: input.consent ? (input.source ?? "profile").slice(0, 100) : null,
      updatedAt: now,
    })
    .where(eq(users.id, input.userId))
    .returning({ id: users.id, showcaseConsentAt: users.showcaseConsentAt });
  if (!updated) throw new ArenaDomainError("FORBIDDEN", "Account not found.");
  await writeAudit(db, {
    actorType: "USER",
    actorSubject: input.userId,
    action: input.consent ? "SHOWCASE_CONSENT_GRANTED" : "SHOWCASE_CONSENT_WITHDRAWN",
    entityType: "user",
    entityId: input.userId,
    metadata: { source: input.source ?? "profile" },
  });
  return { consented: Boolean(updated.showcaseConsentAt), consentedAt: updated.showcaseConsentAt };
}

/**
 * Delete the account: erase the person, keep the arithmetic.
 *
 * A hard delete is not available and pretending otherwise would be worse than
 * saying so. Points, rankings and the ledger are shared, append-only records —
 * removing a row would change a finalized week's leaderboard after the fact and
 * leave the ledger unable to explain a balance. So identity is erased and the
 * history that remains no longer points at a person:
 *
 *   erased   — email, display name, avatar, CV analyses, notifications, and
 *              every draft workspace note the participant wrote;
 *   kept     — rankings, points ledger, review scores, audit entries, all now
 *              attached to an anonymised subject;
 *   blocked  — the account is suspended, so the credential cannot sign back in
 *              and re-attach a name to the history.
 *
 * `auth_subject` is rewritten rather than nulled: it is NOT NULL and unique, and
 * a returning participant must land on a NEW account rather than silently
 * resurrecting this one.
 */
export async function deleteArenaAccount(input: {
  userId: string;
  requestedBy: "USER" | "ADMIN";
  actorSubject: string;
  reason?: string;
  now?: Date;
  db?: Db;
}): Promise<{ userId: string; anonymizedAt: Date; erased: Record<string, number> }> {
  const db = input.db ?? getDb();
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(users).where(eq(users.id, input.userId)).for("update");
    if (!existing) throw new ArenaDomainError("FORBIDDEN", "Account not found.");
    if (existing.anonymizedAt) {
      // Idempotent: a second deletion of an already-anonymised account is a
      // no-op that reports the original timestamp, not an error.
      return { userId: existing.id, anonymizedAt: existing.anonymizedAt, erased: { cvScans: 0, notifications: 0, workspaces: 0 } };
    }

    const scans = await tx.delete(cvScans).where(eq(cvScans.userId, input.userId)).returning({ id: cvScans.id });
    const notices = await tx.select({ id: events.id }).from(events).where(eq(events.userId, input.userId));
    for (const notice of notices) await tx.delete(deliveries).where(eq(deliveries.eventId, notice.id));
    await tx.delete(events).where(eq(events.userId, input.userId));

    // Workspace notes are the participant's own writing about work in progress,
    // not a result anyone else depends on.
    const owned = await tx.select({ id: enrollments.id }).from(enrollments).where(eq(enrollments.userId, input.userId));
    let workspaces = 0;
    for (const enrollment of owned) {
      const cleared = await tx
        .update(workspaceProgress)
        .set({ planText: null, tools: null, taskBreakdown: null, notes: null, reviewChecklist: null, updatedAt: now })
        .where(eq(workspaceProgress.enrollmentId, enrollment.id))
        .returning({ id: workspaceProgress.id });
      workspaces += cleared.length;
    }

    await tx
      .update(users)
      .set({
        authSubject: `deleted:${existing.id}`,
        emailCache: null,
        displayNameCache: null,
        avatarUrlCache: null,
        avatarId: null,
        status: "SUSPENDED",
        showcaseConsentAt: null,
        showcaseConsentSource: null,
        deletionRequestedAt: existing.deletionRequestedAt ?? now,
        anonymizedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, input.userId));

    await writeAudit(tx, {
      actorType: input.requestedBy,
      actorSubject: input.actorSubject,
      action: "ACCOUNT_DELETED",
      entityType: "user",
      entityId: input.userId,
      // No email, no name: an audit row describing a deletion must not be the
      // one place the deleted identity survives.
      metadata: {
        reason: input.reason?.slice(0, 500) ?? null,
        cvScansErased: scans.length,
        notificationsErased: notices.length,
        workspacesCleared: workspaces,
      },
    });

    return {
      userId: input.userId,
      anonymizedAt: now,
      erased: { cvScans: scans.length, notifications: notices.length, workspaces },
    };
  });
}

/** What the profile page shows about the participant's own privacy state. */
export async function getPrivacyState(userId: string, db: Db = getDb()) {
  const [row] = await db
    .select({
      showcaseConsentAt: users.showcaseConsentAt,
      showcaseConsentSource: users.showcaseConsentSource,
      anonymizedAt: users.anonymizedAt,
    })
    .from(users)
    .where(eq(users.id, userId));
  return {
    showcaseConsent: Boolean(row?.showcaseConsentAt),
    showcaseConsentAt: row?.showcaseConsentAt ?? null,
    showcaseConsentSource: row?.showcaseConsentSource ?? null,
    accountDeleted: Boolean(row?.anonymizedAt),
  };
}
