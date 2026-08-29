'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Save, Eye, ChevronLeft, CheckCircle2, Star } from 'lucide-react';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { Input } from '@/components/primitives/Input';
import { Textarea } from '@/components/primitives/Textarea';
import { Badge } from '@/components/primitives/Badge';
import { SkillChip } from '@/components/primitives/SkillChip';
import { cn } from '@/lib/cn';
import type { PortfolioProject } from '@/types/portfolio';

interface CaseStudyEditorProps {
  project: PortfolioProject;
}

export function CaseStudyEditor({ project }: CaseStudyEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(project.title);
  const [role, setRole] = useState(project.role);
  const [challenge, setChallenge] = useState(project.challenge);
  const [approach, setApproach] = useState(project.approach);
  const [result, setResult] = useState(project.result);
  const [skills, setSkills] = useState(project.skills.join(', '));
  const [deliverables, setDeliverables] = useState(project.deliverables.join('\n'));
  const [status, setStatus] = useState<'draft' | 'published'>(project.status);
  const [savingMsg, setSavingMsg] = useState<string | null>(null);

  const handleSave = () => {
    setSavingMsg('Disimpan');
    setTimeout(() => setSavingMsg(null), 1500);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px] items-start">
      <div className="space-y-5 min-w-0">
        <Card padding="lg">
          <SectionLabel>Project Title</SectionLabel>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Card>

        <Card padding="lg">
          <SectionLabel>Your Role</SectionLabel>
          <Input value={role} onChange={(e) => setRole(e.target.value)} />
        </Card>

        <Card padding="lg">
          <SectionLabel>Challenge</SectionLabel>
          <Textarea value={challenge} onChange={(e) => setChallenge(e.target.value)} rows={4} />
        </Card>

        <Card padding="lg">
          <SectionLabel>Approach</SectionLabel>
          <Textarea value={approach} onChange={(e) => setApproach(e.target.value)} rows={5} />
        </Card>

        <Card padding="lg">
          <SectionLabel>Deliverables</SectionLabel>
          <Textarea
            value={deliverables}
            onChange={(e) => setDeliverables(e.target.value)}
            rows={4}
            helper="Satu baris per deliverable."
          />
        </Card>

        <Card padding="lg">
          <SectionLabel>Skills</SectionLabel>
          <Input value={skills} onChange={(e) => setSkills(e.target.value)} helper="Pisahkan dengan koma." />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {skills.split(',').map((s) => s.trim()).filter(Boolean).map((s) => (
              <SkillChip key={s} label={s} size="sm" />
            ))}
          </div>
        </Card>

        <Card padding="lg">
          <SectionLabel>Result</SectionLabel>
          <Textarea value={result} onChange={(e) => setResult(e.target.value)} rows={4} />
        </Card>

        {project.evaluatorQuote && (
          <Card padding="lg" className="bg-[var(--color-surface-soft)]">
            <SectionLabel>Evaluator Feedback (opsional)</SectionLabel>
            <blockquote className="mt-2 border-l-2 border-[var(--color-brand-300)] pl-4 text-[14px] italic text-[var(--color-ink-secondary)]">
              “{project.evaluatorQuote}”
            </blockquote>
            <p className="mt-2 text-[12px] text-[var(--color-ink-tertiary)]">— Sekolah Karir Evaluator</p>
          </Card>
        )}
      </div>

      <aside className="lg:sticky lg:top-24 space-y-4">
        <Card padding="lg">
          <h3 className="text-[14px] font-semibold text-[var(--color-ink-primary)]">Status</h3>
          <div className="mt-3 flex items-center gap-2">
            <Badge variant={status === 'published' ? 'success' : 'neutral'} size="sm">
              {status === 'published' ? 'Published' : 'Draft'}
            </Badge>
            {project.featured && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-brand-600)]">
                <Star className="h-3 w-3 fill-current" />
                Featured
              </span>
            )}
          </div>
          <p className="mt-3 text-[12px] text-[var(--color-ink-tertiary)]">
            {status === 'published' ? 'Case study ini sudah tampil di portfolio publik-mu.' : 'Case study ini hanya terlihat oleh kamu.'}
          </p>
        </Card>

        <Card padding="lg">
          <h3 className="text-[14px] font-semibold text-[var(--color-ink-primary)]">Aksi</h3>
          <div className="mt-3 flex flex-col gap-2">
            <Button
              variant="secondary"
              onClick={handleSave}
              iconLeft={<Save className="h-4 w-4" />}
              fullWidth
            >
              Simpan Draft
            </Button>
            <Link href={`/app/portfolio/${project.id}/preview`}>
              <Button variant="secondary" iconLeft={<Eye className="h-4 w-4" />} fullWidth>
                Preview
              </Button>
            </Link>
            <Button
              variant="primary"
              onClick={() => setStatus(status === 'published' ? 'draft' : 'published')}
              iconLeft={<CheckCircle2 className="h-4 w-4" />}
              fullWidth
            >
              {status === 'published' ? 'Jadikan Draft' : 'Publish'}
            </Button>
          </div>
          {savingMsg && (
            <p className="mt-3 text-[12px] text-[var(--color-success)] font-medium">{savingMsg}</p>
          )}
        </Card>

        <Card padding="lg" className="bg-[var(--color-surface-soft)]">
          <h3 className="text-[14px] font-semibold text-[var(--color-ink-primary)]">Tips</h3>
          <ul className="mt-3 flex flex-col gap-2.5">
            {[
              'Tulis Challenge dengan jelas: apa masalahnya, untuk siapa.',
              'Approach: jelaskan proses dan keputusan kunci.',
              'Result: gunakan angka atau dampak terukur.',
            ].map((t) => (
              <li key={t} className="text-[12.5px] text-[var(--color-ink-tertiary)] leading-relaxed flex gap-2">
                <span className="text-[var(--color-brand-500)] font-bold">·</span>
                {t}
              </li>
            ))}
          </ul>
        </Card>
      </aside>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-tertiary)]">
      {children}
    </p>
  );
}
