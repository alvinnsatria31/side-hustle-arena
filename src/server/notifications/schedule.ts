type Week = { id: string; weekCode: string; status: string; opensAt: Date; submissionDeadlineAt: Date };

export function scheduledWeekNotices(week: Week, now: Date) {
  if (week.status !== "OPEN" || now < week.opensAt || now >= week.submissionDeadlineAt) return [];
  const notices: Array<{ type: "PROJECT_DROP" | "DEADLINE_REMINDER"; weekId: string; title: string; body: string; actionUrl: string }> = [{
    type: "PROJECT_DROP", weekId: week.id, title: "Project minggu ini sudah dibuka",
    body: `Project Arena ${week.weekCode} sudah tersedia.`, actionUrl: "/app/arena",
  }];
  if (week.submissionDeadlineAt.getTime() - now.getTime() <= 24 * 3600_000) {
    notices.push({ type: "DEADLINE_REMINDER", weekId: week.id, title: "Deadline project mendekat",
      body: `Submission ${week.weekCode} ditutup ${week.submissionDeadlineAt.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" })} WIB.`,
      actionUrl: "/app/arena" });
  }
  return notices;
}
