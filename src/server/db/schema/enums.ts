import { arena, audit, automation, identity, notifications, rewards } from "./schemas";

export const userStatus = identity.enum("user_status", ["ACTIVE", "SUSPENDED"]);

export const weekStatus = arena.enum("week_status", ["DRAFT", "PREVIEW", "SCHEDULED", "OPEN", "CLOSED", "FINALIZING", "FINALIZED", "ARCHIVED", "FAILED"]);
export const leaderboardScope = arena.enum("leaderboard_scope", ["GLOBAL"]);
export const tieBreakMethod = arena.enum("tie_break_method", ["EARLIEST_FINAL_SUBMISSION"]);
export const projectStatus = arena.enum("project_status", ["DRAFT", "PREVIEWED", "SCHEDULED", "PUBLISHED", "REJECTED", "ARCHIVED"]);
export const difficultyBand = arena.enum("difficulty_band", ["STANDARD"]);
export const projectPreviewStatus = arena.enum("project_preview_status", ["PENDING", "APPROVED", "REJECTED", "REGENERATE_REQUESTED", "AUTO_APPROVED"]);
export const submissionRequirementType = arena.enum("submission_requirement_type", ["FILE", "LINK", "TEXT"]);
export const enrollmentStatus = arena.enum("enrollment_status", ["ACTIVE", "SUBMITTED", "UNDER_REVIEW", "REVIEW_READY", "COMPLETED", "VOIDED"]);
export const workspaceStep = arena.enum("workspace_step", ["BRIEF", "PLAN", "WORK", "REVIEW", "SUBMIT"]);
export const submissionStatus = arena.enum("submission_status", ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "REVIEWED_HIDDEN", "FINALIZED", "VOIDED"]);
export const accessStatus = arena.enum("access_status", ["PENDING", "CHECKING", "ACCESSIBLE", "FAILED", "NOT_REQUIRED"]);
export const submissionReviewStatus = arena.enum("submission_review_status", ["NOT_QUEUED", "QUEUED", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"]);
export const reviewJobStatus = arena.enum("review_job_status", ["PENDING", "PROCESSING", "RETRY", "COMPLETED", "FAILED", "CANCELLED"]);
export const reviewStatus = arena.enum("review_status", ["PROCESSING", "COMPLETED_HIDDEN", "NEEDS_RESOLUTION", "PUBLISHED", "FAILED", "VOIDED"]);

export const pointLedgerEntryType = rewards.enum("point_ledger_entry_type", ["WEEKLY_RANK", "REWARD_REDEMPTION", "ADMIN_ADJUSTMENT", "ADMIN_REVERSAL"]);
export const rewardType = rewards.enum("reward_type", ["DIGITAL", "DISCOUNT", "EVENT", "MASTERCLASS", "SERVICE", "MONETARY"]);
export const inventoryMode = rewards.enum("inventory_mode", ["UNLIMITED", "LIMITED"]);
export const redemptionStatus = rewards.enum("redemption_status", ["PENDING", "PROCESSING", "FULFILLED", "FAILED", "ADMIN_REVERSED"]);

export const notificationType = notifications.enum("notification_type", ["PROJECT_DROP", "DEADLINE_REMINDER", "SUBMISSION_RECEIVED", "SUBMISSION_ACCESS_FAILED", "RESULT_READY", "POINTS_AWARDED", "MILESTONE_REACHED", "REWARD_REDEEMED", "REWARD_FULFILLED"]);
export const notificationChannel = notifications.enum("notification_channel", ["IN_APP", "WEB_PUSH", "EMAIL", "WHATSAPP_COMMUNITY", "DISCORD_COMMUNITY"]);
export const deliveryStatus = notifications.enum("delivery_status", ["PENDING", "SENT", "FAILED", "SKIPPED"]);

export const automationRunType = automation.enum("automation_run_type", ["PROJECT_GENERATION", "PROJECT_PREVIEW", "PROJECT_PUBLICATION", "ACCESS_CHECK", "AI_REVIEW", "WEEK_CLOSE", "WEEK_FINALIZATION", "LEADERBOARD_GENERATION", "POINT_DISTRIBUTION", "NOTIFICATION_BROADCAST"]);
export const automationRunStatus = automation.enum("automation_run_status", ["PENDING", "RUNNING", "SUCCESS", "PARTIAL", "FAILED", "CANCELLED"]);
export const auditActorType = audit.enum("audit_actor_type", ["USER", "ADMIN", "AUTOMATION", "SYSTEM"]);
