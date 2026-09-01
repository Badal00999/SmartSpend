import { NavLink, useNavigate } from 'react-router-dom';
import { Home, BarChart3, Plus, History, Settings, LogOut } from 'lucide-react';
import { useStore } from '@/lib/store';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/history', label: 'History', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings }
];

export function Sidebar() {
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const signOut = useStore((s) => s.signOut);

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-card/60 backdrop-blur-md lg:flex">
      <button onClick={() => navigate('/')} className="flex items-center gap-2 px-6 py-6 text-left">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 text-white">
          <span className="text-lg">₹</span>
        </div>
        <div>
          <div className="text-base font-bold tracking-tight">SmartSpend</div>
          <div className="text-[10px] text-muted-foreground">Automatic Expense Tracker</div>
        </div>
      </button>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all hover:bg-accent',
                isActive ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground'
              )
            }
          >
            <Icon className="h-[18px] w-[18px]" />
            {label}
          </NavLink>
        ))}
        <button
          onClick={() => navigate('/add-expense')}
          className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-emerald-500 px-3 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:opacity-95 active:scale-[0.97]"
        >
          <Plus className="h-5 w-5" />
          Add Expense
        </button>
        <div className="mt-4 flex flex-col gap-3 rounded-xl bg-muted/60 p-3">
          <div className="flex items-center gap-3">
            <Avatar fallback={user?.full_name || user?.email || 'U'} size="sm" />
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold">{user?.full_name || 'User'}</div>
              <div className="truncate text-[10px] text-muted-foreground">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={async () => {
              await signOut();
              navigate('/login');
            }}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </nav>
    </aside>
  );
}
