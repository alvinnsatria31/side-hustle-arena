import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { catalog, redemptions } from "@/server/db/schema";
import { ArenaDomainError } from "@/server/arena/errors";
import { writeAudit } from "@/server/reviews/audit";
import { acquireDeliveryLease, fulfillRedemption, releaseDeliveryLease } from "./redemption-service";

type Db = ReturnType<typeof getDb>;

/**
 * Digital reward delivery — the link half of the reward catalog.
 *
 * A DIGITAL reward is a page the participant opens: the Notion job-hunt kit,
 * an e-book, a template pack. There is no external system to call, so delivery
 * is simply "hand over the address": the claim is fulfilled with a note that
 * carries the link, and the REWARD_FULFILLED notification queues the same link
 * as an email. The note on the profile and the email are two copies of one
 * fact, which is what keeps a lost email from costing the reward.
 *
 * The link is per SKU (`catalog.delivery_url`), set by an admin. An unset link
 * leaves the claim PENDING with an audited deferral rather than serving an
 * address nobody has checked — the same shape as an unconfigured voucher push.
 */

export type DigitalDelivery =
  | { status: "NOT_DIGITAL" }
  | { status: "ALREADY_SETTLED"; redemptionStatus: string }
  | { status: "IN_PROGRESS" }
  | { status: "DELIVERED"; url: string }
  | { status: "MANUAL_REQUIRED"; reason: string };

/** Rewards whose fulfilment is a link rather than a code or a payout. */
export function isDigitalReward(rewardType: string): boolean {
  return rewardType === "DIGITAL";
}

/** What the participant reads on their profile once the link is theirs. */
export function digitalDeliveryNote(url: string, rewardTitle: string): string {
  return `Link ${rewardTitle}: ${url}\nTautan yang sama juga dikirim ke emailmu.`;
}

export async function deliverDigitalReward(input: {
  redemptionId: string;
  actorType?: "AUTOMATION" | "ADMIN";
  actorSubject?: string;
  db?: Db;
}): Promise<DigitalDelivery> {
  const db = input.db ?? getDb();
  const actorType = input.actorType ?? "AUTOMATION";
  const actorSubject = input.actorSubject ?? "digital-delivery";

  const [take] = await db.select({ rewardId: redemptions.rewardId }).from(redemptions).where(eq(redemptions.id, input.redemptionId));
  if (!take) throw new ArenaDomainError("VALIDATION_ERROR", "Redemption not found.");
  const [sku] = await db.select({ rewardType: catalog.rewardType, title: catalog.title, deliveryUrl: catalog.deliveryUrl })
    .from(catalog).where(eq(catalog.id, take.rewardId));
  if (!sku) throw new ArenaDomainError("VALIDATION_ERROR", "Reward SKU not found.");
  if (!isDigitalReward(sku.rewardType)) return { status: "NOT_DIGITAL" };

  const url = sku.deliveryUrl?.trim();
  if (!url) {
    const reason = "Link pengiriman reward ini belum diisi di admin.";
    await writeAudit(db, {
      actorType, actorSubject, action: "REWARD_DIGITAL_DELIVERY_DEFERRED", entityType: "redemption", entityId: input.redemptionId,
      metadata: { reason, configured: false, fulfillment: "MANUAL_REQUIRED" },
    });
    return { status: "MANUAL_REQUIRED", reason };
  }

  // The claim sits in PROCESSING while it is served, so an admin reversal
  // cannot refund the points underneath a fulfilment that is already running.
  const lease = await acquireDeliveryLease({ redemptionId: input.redemptionId, db });
  if (!lease.acquired) {
    return lease.reason === "IN_PROGRESS"
      ? { status: "IN_PROGRESS" }
      : { status: "ALREADY_SETTLED", redemptionStatus: lease.redemptionStatus };
  }
  try {
    await fulfillRedemption({
      redemptionId: input.redemptionId, actorSubject, actorType, verification: "DIGITAL_LINK_SENT",
      reference: digitalDeliveryNote(url, sku.title), deliveryLink: url, rewardTitle: sku.title, db,
    });
    return { status: "DELIVERED", url };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await releaseDeliveryLease({ redemptionId: input.redemptionId, leaseToken: lease.leaseToken, db });
    await writeAudit(db, {
      actorType, actorSubject, action: "REWARD_DIGITAL_DELIVERY_DEFERRED", entityType: "redemption", entityId: input.redemptionId,
      metadata: { url, reason, configured: true, fulfillment: "MANUAL_REQUIRED" },
    });
    return { status: "MANUAL_REQUIRED", reason };
  }
}
