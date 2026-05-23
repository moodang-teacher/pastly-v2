'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Archive } from 'lucide-react';

export default function CohortsPage() {
  const supabase = createClient();
  const [teacher, setTeacher] = useState<any>(null);
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: t } = await supabase
        .from('teachers').select('*, department:departments(*)')
        .eq('user_id', user!.id).single();
      setTeacher(t);

      const { data: ch } = await supabase
        .from('cohorts').select('*')
        .eq('teacher_id', t.id)
        .order('created_at', { ascending: false });
      setCohorts(ch || []);
      setLoading(false);
    }
    load();
  }, []);

  async function createCohort() {
    if (!newName.trim() || !teacher) return;
    const { data, error } = await supabase.from('cohorts').insert({
      name: newName.trim(),
      department_id: teacher.department_id,
      teacher_id: teacher.id,
      is_active: true,
    }).select().single();

    if (!error && data) {
      setCohorts(prev => [data, ...prev]);
      setNewName('');
      setMsg('✅ 기수가 생성되었습니다.');
      setTimeout(() => setMsg(''), 3000);
    }
  }

  async function archiveCohort(id: string) {
    if (!confirm('이 기수를 아카이브하시겠습니까?\n학생 기록은 보존됩니다.')) return;
    await supabase.from('cohorts').update({ is_active: false, archived_at: new Date().toISOString() }).eq('id', id);
    setCohorts(prev => prev.map(c => c.id === id ? { ...c, is_active: false } : c));
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const active = cohorts.filter(c => c.is_active);
  const archived = cohorts.filter(c => !c.is_active);

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-black text-slate-900 dark:text-white">기수 관리</h1>
      <p className="text-sm text-slate-500">기수는 학년/학기를 구분합니다. 새 학기 시작 시 새 기수를 만드세요.</p>

      {msg && <p className="text-center text-sm font-bold text-emerald-600 bg-emerald-50 py-2.5 rounded-2xl">{msg}</p>}

      {/* 새 기수 생성 */}
      <div className="card p-5">
        <h2 className="font-black text-slate-800 dark:text-white mb-3">새 기수 만들기</h2>
        <div className="flex gap-2">
          <input
            className="input-field"
            placeholder="예: 2025년 1기"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createCohort()}
          />
          <button
            onClick={createCohort}
            disabled={!newName.trim()}
            className="flex items-center gap-2 px-4 py-3 bg-brand-600 text-white font-bold rounded-2xl whitespace-nowrap disabled:opacity-40 active:scale-95 transition-all"
          >
            <Plus size={16} /> 생성
          </button>
        </div>
      </div>

      {/* 활성 기수 */}
      <div className="card p-5">
        <h2 className="font-black text-slate-800 dark:text-white mb-3">활성 기수 ({active.length})</h2>
        {active.length === 0 ? (
          <p className="text-center text-slate-400 py-4 text-sm">활성 기수가 없습니다</p>
        ) : (
          <div className="space-y-2">
            {active.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                <div>
                  <p className="font-bold text-sm text-emerald-800 dark:text-emerald-300">{c.name}</p>
                  <p className="text-xs text-emerald-600">{new Date(c.created_at).toLocaleDateString('ko-KR')} 생성</p>
                </div>
                <button
                  onClick={() => archiveCohort(c.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl active:scale-95 transition-all"
                >
                  <Archive size={13} /> 아카이브
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 아카이브된 기수 */}
      {archived.length > 0 && (
        <div className="card p-5">
          <h2 className="font-black text-slate-800 dark:text-white mb-3 opacity-60">아카이브 ({archived.length})</h2>
          <div className="space-y-2 opacity-60">
            {archived.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div>
                  <p className="font-bold text-sm dark:text-white">{c.name}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(c.archived_at).toLocaleDateString('ko-KR')} 종료
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
