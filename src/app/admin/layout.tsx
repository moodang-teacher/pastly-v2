import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AdminNav from '@/components/admin/AdminNav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: teacher } = await supabase
    .from('teachers')
    .select('*, department:departments(*)')
    .eq('user_id', user.id)
    .single();

  if (!teacher) redirect('/home');

  const isEmailUser = user.identities?.some((i: any) => i.provider === 'email') ?? false;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <AdminNav teacher={teacher} isEmailUser={isEmailUser} />
      <main className="max-w-2xl mx-auto p-5 pt-6">
        {children}
      </main>
    </div>
  );
}
