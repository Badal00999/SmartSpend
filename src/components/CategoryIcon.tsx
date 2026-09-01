import { cn } from '@/lib/utils';

interface CategoryIconProps {
  icon?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'h-8 w-8 text-sm',
  md: 'h-11 w-11 text-lg',
  lg: 'h-14 w-14 text-2xl'
};

export function CategoryIcon({ icon = '📦', color = '#6366F1', size = 'md', className }: CategoryIconProps) {
  return (
    <div
      className={cn('flex shrink-0 items-center justify-center rounded-xl shadow-sm', sizes[size], className)}
      style={{ backgroundColor: `${color}22` }}
    >
      <span className="leading-none">{icon}</span>
    </div>
  );
}
