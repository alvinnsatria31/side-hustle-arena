/**
 * Week statuses whose results have been announced and still stand.
 *
 * ARCHIVED only takes a week out of the current views; its rankings, points
 * and skill evidence stay official. Reading achievements with FINALIZED alone
 * made an archived project vanish from the profile, Career Report and Jobs
 * while its result page still opened.
 */
export const PUBLISHED_WEEK_STATUSES = ["FINALIZED", "ARCHIVED"] as const;

export type PublishedWeekStatus = (typeof PUBLISHED_WEEK_STATUSES)[number];

export function isPublishedWeekStatus(status: string): status is PublishedWeekStatus {
  return (PUBLISHED_WEEK_STATUSES as readonly string[]).includes(status);
}
