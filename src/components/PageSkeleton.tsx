import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';

interface PageSkeletonProps {
  variant?: 'dashboard' | 'list' | 'form';
  className?: string;
}

export function PageSkeleton({ variant = 'dashboard', className }: PageSkeletonProps) {
  return (
    <div className={cn('flex flex-col gap-4 p-4 sm:p-6', className)}>
      {variant === 'dashboard' && (
        <>
          <div className="flex gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 flex-1" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
          <div className="flex gap-3">
            <Skeleton className="h-56 flex-1" />
            <Skeleton className="h-56 flex-1" />
          </div>
        </>
      )}
      {variant === 'list' && (
        <>
          <Skeleton className="h-12 w-full" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </>
      )}
      {variant === 'form' && (
        <>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-14 w-full" />
        </>
      )}
    </div>
  );
}
