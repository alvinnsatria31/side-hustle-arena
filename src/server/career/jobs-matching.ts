export type SampleJob = {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  skills: string[];
};
export type MatchedJob = SampleJob & { matchScore: number | null; matchedSkills: string[]; missingSkills: string[] };
export type JobsFilters = { search?: string; type?: string; location?: string };
export const JOBS_SOURCE_LABEL = 'Hardcoded / contoh lowongan — belum terhubung feed lowongan nyata';
// ponytail: static fictional catalog until a real provider supplies verified openings.
export const SAMPLE_JOBS: SampleJob[] = [
  { id: 'sample-data', title: 'Junior Data Analyst', company: 'Studio Data Contoh (fiktif)', location: 'Jakarta', type: 'Full-time', skills: ['Excel', 'SQL', 'Data Visualization'] },
  { id: 'sample-bi', title: 'Business Intelligence Intern', company: 'Laboratorium Wawasan (fiktif)', location: 'Remote', type: 'Internship', skills: ['Excel', 'Dashboard', 'Business Insight'] },
  { id: 'sample-marketing', title: 'Marketing Analytics Associate', company: 'Kampanye Imajinasi (fiktif)', location: 'Bandung', type: 'Contract', skills: ['Campaign Analysis', 'Reporting', 'Communication'] },
  { id: 'sample-design', title: 'Junior Product Designer', company: 'Studio Antarmuka Contoh (fiktif)', location: 'Remote', type: 'Full-time', skills: ['Figma', 'User Research', 'Prototyping'] },
  { id: 'sample-web', title: 'Frontend Developer Intern', company: 'Web Rekaan (fiktif)', location: 'Jakarta', type: 'Internship', skills: ['HTML', 'CSS', 'JavaScript'] },
  { id: 'sample-ops', title: 'Operations Analyst', company: 'Operasi Simulasi (fiktif)', location: 'Surabaya', type: 'Full-time', skills: ['Excel', 'Data Cleaning', 'Presentation'] },
];

const normalize = (value: string) => value.trim().toLowerCase();

export function matchJobs(jobs: SampleJob[], skills: string[]): MatchedJob[] {
  const evidence = new Set(skills.map(normalize).filter(Boolean));
  return jobs.map((job) => {
    const unique = new Map<string, string>();
    for (const skill of job.skills) {
      const key = normalize(skill);
      if (key && !unique.has(key)) unique.set(key, skill.trim());
    }
    const required = [...unique.values()];
    const matchedSkills = required.filter(skill => evidence.has(normalize(skill)));
    return {
      ...job,
      skills: required,
      matchedSkills,
      missingSkills: required.filter(skill => !evidence.has(normalize(skill))),
      matchScore: evidence.size && required.length ? Math.round(matchedSkills.length / required.length * 100) : null,
    };
  }).sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1) || a.id.localeCompare(b.id));
}

export function filterJobs(jobs: MatchedJob[], filters: JobsFilters): MatchedJob[] {
  const search = normalize(filters.search ?? '');
  return jobs.filter(job =>
    (!filters.type || job.type === filters.type) &&
    (!filters.location || job.location === filters.location) &&
    (!search || normalize([job.title, job.company, job.location, ...job.skills].join(' ')).includes(search)),
  );
}

export function safeJobsPortalUrl(value?: string): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export type JobsOverview = {
  source: 'hardcoded';
  sourceLabel: string;
  skills: string[];
  jobs: MatchedJob[];
  matchCount: number;
  portalUrl: string | null;
};
