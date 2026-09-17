import { relations } from "drizzle-orm";
import { weeks, weekRules } from "./arena-core";
import { projects, projectRubricCriteria, projectSkills, projectSubmissionRequirements, skills } from "./projects";
import { enrollments, submissionDraftItems, submissions, submissionVersionItems, submissionVersions, uploadIntents, workspaceProgress } from "./submissions";
import { reviewJobs, reviewOverrides, reviewScores, reviews, skillEvidence } from "./reviews";
import { weeklyRankings } from "./rankings";
import { pointAccounts, pointLedger, redemptions, catalog, inventoryPeriods } from "./rewards";
import { events, deliveries } from "./notifications";
import { entitlements, orders, paymentEvents, products } from "./store";
import { users } from "./identity";

export const userRelations = relations(users, ({ many, one }) => ({
  enrollments: many(enrollments),
  submissions: many(submissions),
  rankings: many(weeklyRankings),
  pointAccount: one(pointAccounts),
  pointLedgerEntries: many(pointLedger),
  redemptions: many(redemptions),
  storeOrders: many(orders),
  entitlements: many(entitlements),
}));

export const weekRelations = relations(weeks, ({ many, one }) => ({
  rules: one(weekRules),
  projects: many(projects),
  enrollments: many(enrollments),
  rankings: many(weeklyRankings),
}));

export const projectRelations = relations(projects, ({ many }) => ({
  skills: many(projectSkills),
  rubricCriteria: many(projectRubricCriteria),
  submissionRequirements: many(projectSubmissionRequirements),
  enrollments: many(enrollments),
}));

export const projectSkillRelations = relations(projectSkills, ({ one }) => ({
  project: one(projects, { fields: [projectSkills.projectId], references: [projects.id] }),
  skill: one(skills, { fields: [projectSkills.skillId], references: [skills.id] }),
}));

export const enrollmentRelations = relations(enrollments, ({ one }) => ({
  user: one(users, { fields: [enrollments.userId], references: [users.id] }),
  week: one(weeks, { fields: [enrollments.weekId], references: [weeks.id] }),
  project: one(projects, { fields: [enrollments.projectId], references: [projects.id] }),
  workspaceProgress: one(workspaceProgress),
  submission: one(submissions),
}));

export const submissionRelations = relations(submissions, ({ many, one }) => ({
  enrollment: one(enrollments, { fields: [submissions.enrollmentId], references: [enrollments.id] }),
  versions: many(submissionVersions),
  draftItems: many(submissionDraftItems),
  uploadIntents: many(uploadIntents),
}));

export const submissionVersionRelations = relations(submissionVersions, ({ many, one }) => ({
  submission: one(submissions, { fields: [submissionVersions.submissionId], references: [submissions.id] }),
  items: many(submissionVersionItems),
  reviewJob: one(reviewJobs),
  review: one(reviews),
}));

export const reviewRelations = relations(reviews, ({ many, one }) => ({
  submissionVersion: one(submissionVersions, { fields: [reviews.submissionVersionId], references: [submissionVersions.id] }),
  scores: many(reviewScores),
  evidence: many(skillEvidence),
  overrides: many(reviewOverrides),
}));

export const rewardRelations = relations(catalog, ({ many }) => ({
  inventoryPeriods: many(inventoryPeriods),
  redemptions: many(redemptions),
}));

export const notificationEventRelations = relations(events, ({ many }) => ({
  deliveries: many(deliveries),
}));

export const storeProductRelations = relations(products, ({ many }) => ({
  orders: many(orders),
  entitlements: many(entitlements),
}));

export const storeOrderRelations = relations(orders, ({ many, one }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  product: one(products, { fields: [orders.productId], references: [products.id] }),
  entitlement: one(entitlements),
  paymentEvents: many(paymentEvents),
}));

export const storeEntitlementRelations = relations(entitlements, ({ one }) => ({
  user: one(users, { fields: [entitlements.userId], references: [users.id] }),
  product: one(products, { fields: [entitlements.productId], references: [products.id] }),
  order: one(orders, { fields: [entitlements.orderId], references: [orders.id] }),
}));
