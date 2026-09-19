import { Badge } from '@/components/primitives/Badge';

export function difficultyLabel(level: string) {
  return ({ Beginner: 'Pemula', Intermediate: 'Menengah', Advanced: 'Mahir' } as Record<string, string>)[level] ?? level;
}

export function DifficultyBadge({ level, dark }: { level: string; dark?: boolean }) {
  return <Badge variant={dark ? 'dark' : 'blue'}>{difficultyLabel(level)}</Badge>;
}

export function TimeBadge({ time, dark }: { time: string; dark?: boolean }) {
  return <Badge variant={dark ? 'dark' : 'mint'}>{time}</Badge>;
}

export function DeadlineBadge({ label = 'Batas pengumpulan', dark }: { label?: string; dark?: boolean }) {
  return <Badge variant={dark ? 'dark' : 'amber'}>{label}</Badge>;
}
