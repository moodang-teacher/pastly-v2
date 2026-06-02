import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import MasterNav from '@/components/master/MasterNav';

export default async function MasterLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: teacher } = await supabase
    .from('teachers')
    .select('name, is_master')
    .eq('user_id', user.id)
    .single();

  if (!teacher?.is_master) redirect('/home');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <MasterNav name={teacher.name} />
      <main className="max-w-2xl mx-auto p-5 pt-6">
        {children}
      </main>
    </div>
  );
}
