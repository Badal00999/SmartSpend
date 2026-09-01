import { NavLink, useLocation } from 'react-router-dom';
import { Home, BarChart3, Plus, History, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const location = useLocation();

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/80 backdrop-blur-lg lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="mx-auto grid max-w-md grid-cols-5 items-center px-2 py-1.5">
        <NavItem to="/" label="Home" icon={Home} active={isActive('/')} />
        <NavItem to="/analytics" label="Insights" icon={BarChart3} active={isActive('/analytics')} />
        <div className="relative -mt-7 flex justify-center">
          <NavLink
            to="/add-expense"
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-emerald-500 text-white shadow-glass-lg transition-transform active:scale-90"
          >
            <Plus className="h-7 w-7" />
          </NavLink>
        </div>
        <NavItem to="/history" label="History" icon={History} active={isActive('/history')} />
        <NavItem to="/settings" label="Settings" icon={Settings} active={isActive('/settings')} />
      </div>
    </nav>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  active
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <NavLink
      to={to}
      className="flex flex-col items-center gap-0.5 py-1.5"
    >
      <span
        className={cn(
          'flex h-8 w-12 items-center justify-center rounded-full transition-all',
          active ? 'bg-indigo-500/15 text-indigo-500' : 'text-muted-foreground'
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className={cn('text-[10px] font-medium', active ? 'text-indigo-500' : 'text-muted-foreground')}>
        {label}
      </span>
    </NavLink>
  );
}
