import type { JobMatch } from '@/types/report';

export const MOCK_JOB_MATCHES: JobMatch[] = [
  {
    id: 'job-1',
    title: 'Junior Data Analyst',
    company: 'Tokopedia',
    location: 'Jakarta',
    matchScore: 86,
    skills: ['Excel', 'SQL', 'Data Visualization'],
    type: 'Full-time',
  },
  {
    id: 'job-2',
    title: 'Business Intelligence Intern',
    company: 'Gojek',
    location: 'Jakarta · Hybrid',
    matchScore: 82,
    skills: ['Excel', 'Dashboard', 'Business Insight'],
    type: 'Internship',
  },
  {
    id: 'job-3',
    title: 'Reporting & Analytics Officer',
    company: 'Bank Neo Commerce',
    location: 'Bandung',
    matchScore: 78,
    skills: ['Excel', 'Reporting', 'Communication'],
    type: 'Full-time',
  },
  {
    id: 'job-4',
    title: 'Data Analyst (FMCG)',
    company: 'Unilever Indonesia',
    location: 'Tangerang',
    matchScore: 74,
    skills: ['Excel', 'Data Cleaning', 'Presentation'],
    type: 'Full-time',
  },
  {
    id: 'job-5',
    title: 'Marketing Analytics Associate',
    company: 'Shopee',
    location: 'Jakarta',
    matchScore: 71,
    skills: ['Excel', 'Campaign Analysis'],
    type: 'Contract',
  },
  {
    id: 'job-6',
    title: 'Junior Data Analyst',
    company: 'Ruangguru',
    location: 'Jakarta · Hybrid',
    matchScore: 69,
    skills: ['Excel', 'SQL Basics'],
    type: 'Full-time',
  },
];

export const JOBS_PORTAL_URL = 'https://jobs.sekolahkarir.id';
