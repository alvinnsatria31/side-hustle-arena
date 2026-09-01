import { Badge } from '@/components/primitives/Badge';

export function DifficultyBadge({ level, dark }: { level: string; dark?: boolean }) {
  return <Badge variant={dark ? 'dark' : 'blue'}>{level}</Badge>;
}

export function TimeBadge({ time, dark }: { time: string; dark?: boolean }) {
  return <Badge variant={dark ? 'dark' : 'mint'}>{time}</Badge>;
}

export function DeadlineBadge({ label = 'Deadline Jumat', dark }: { label?: string; dark?: boolean }) {
  return <Badge variant={dark ? 'dark' : 'amber'}>{label}</Badge>;
}
