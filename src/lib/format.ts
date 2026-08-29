export function formatNumber(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value);
}

export function formatPoints(value: number): string {
  return `${formatNumber(value)} pts`;
}

export function formatScore(value: number, total = 100): string {
  return `${value} / ${total}`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
  });
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function relativeDays(target: Date | string): string {
  const t = typeof target === 'string' ? new Date(target) : target;
  const ms = t.getTime() - Date.now();
  const days = Math.round(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Hari ini';
  if (days === 1) return '1 hari lagi';
  if (days > 0) return `${days} hari lagi`;
  if (days === -1) return '1 hari yang lalu';
  return `${Math.abs(days)} hari yang lalu`;
}
