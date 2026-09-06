import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJobs, filterJobs, safeJobsPortalUrl, SAMPLE_JOBS } from '../src/server/career/jobs-matching.ts';

test('overlap counts distinct required skills, rounds transparently and sorts deterministically', () => {
  const jobs = [
    { id: 'b', title: 'Second', company: 'Fiksi', location: 'Remote', type: 'Contract', skills: ['SQL', 'Excel', 'Reporting'] },
    { id: 'a', title: 'First', company: 'Fiksi', location: 'Jakarta', type: 'Full-time', skills: ['SQL', 'sql', 'Excel'] },
  ];
  const matched = matchJobs(jobs, [' sql ', 'SQL']);
  assert.deepEqual(matched.map(job => [job.id, job.matchScore]), [['a', 50], ['b', 33]]);
  assert.deepEqual(matched[0].matchedSkills, ['SQL']);
  assert.deepEqual(matched[0].missingSkills, ['Excel']);
  assert.equal(matched[0].skills.length, 2);
});

test('no finalized skills means no invented score or match; empty requirements have no score', () => {
  assert.ok(matchJobs(SAMPLE_JOBS, []).every(job => job.matchScore === null));
  assert.ok(matchJobs(SAMPLE_JOBS, ['unrelated']).every(job => job.matchScore === 0));
  assert.equal(matchJobs([{ ...SAMPLE_JOBS[0], skills: [] }], ['SQL'])[0].matchScore, null);
});

test('search, employment type and location combine and return an honest empty result', () => {
  const jobs = matchJobs(SAMPLE_JOBS, ['Excel']);
  const first = jobs[0];
  assert.ok(filterJobs(jobs, { search: first.title.toUpperCase(), type: first.type, location: first.location }).some(job => job.id === first.id));
  assert.equal(filterJobs(jobs, { search: 'no-such-role' }).length, 0);
  assert.equal(filterJobs(jobs, { type: 'no-such-type' }).length, 0);
});

test('sample catalog is explicitly fictional and has no fabricated application links', () => {
  assert.ok(SAMPLE_JOBS.length > 0);
  for (const job of SAMPLE_JOBS) {
    assert.match(job.company, /fiktif/i);
    assert.equal('url' in job || 'applicationUrl' in job, false);
  }
});

test('only credential-free HTTPS portal links are exposed; no default production claim', () => {
  assert.equal(safeJobsPortalUrl(), null);
  for (const value of ['', '/jobs', '//example.com', 'javascript:alert(1)', 'data:text/html,hi', 'http://example.com', 'https://user:pass@example.com', 'not a url']) {
    assert.equal(safeJobsPortalUrl(value), null, value);
  }
  assert.equal(safeJobsPortalUrl('https://jobs.example.com/openings'), 'https://jobs.example.com/openings');
});
