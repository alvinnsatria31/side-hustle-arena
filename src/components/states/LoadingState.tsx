import { Skeleton } from '@/components/primitives/Skeleton';
import { cn } from '@/lib/cn';

interface LoadingStateProps {
  variant?: 'card' | 'list' | 'detail';
  className?: string;
}

export function LoadingState({ variant = 'card', className }: LoadingStateProps) {
  if (variant === 'list') {
    return (
      <div className={cn('flex flex-col gap-3', className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }
  if (variant === 'detail') {
    return (
      <div className={cn('flex flex-col gap-4', className)}>
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    );
  }
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}
