'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, BookOpen, RotateCcw, LayoutDashboard, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

const NAV = [
  { href: '/admin',           icon: LayoutDashboard, label: '대시보드' },
  { href: '/admin/questions', icon: BookOpen,         label: '문제 관리' },
  { href: '/admin/students',  icon: Users,            label: '학생 관리' },
  { href: '/admin/reset',     icon: RotateCcw,        label: '초기화' },
];

export default function AdminNav({ teacher }: { teacher: any }) {
  const path = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-40">
      <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-black text-brand-600 dark:text-brand-400">Pastly</span>
          <span className="text-xs bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 px-2 py-0.5 rounded-lg font-bold">
            관리자
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-600 dark:text-slate-300 hidden sm:block">
            {teacher?.name} 선생님
          </span>
          <button onClick={logout} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
            <LogOut size={18} />
          </button>
        </div>
      </div>
      <nav className="max-w-2xl mx-auto px-5 flex gap-1 overflow-x-auto no-scrollbar pb-1">
        {NAV.map(n => {
          const active = path === n.href || (n.href !== '/admin' && path.startsWith(n.href));
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                active
                  ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <n.icon size={15} />
              {n.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
