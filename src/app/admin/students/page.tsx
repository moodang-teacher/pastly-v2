'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getLevelLabel } from '@/types';
import { UserPlus, Trash2, Search } from 'lucide-react';

export default function StudentsPage() {
  const supabase = createClient();
  const [teacher, setTeacher] = useState<any>(null);
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]); // 배정 안된 학생들
  const [search, setSearch] = useState('');
  const [selectedCohort, setSelectedCohort] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: t } = await supabase
        .from('teachers').select('*, department:departments(*)')
        .eq('user_id', user!.id).single();
      setTeacher(t);

      // 내 전공 활성 기수
      const { data: ch } = await supabase
        .from('cohorts')
        .select('*')
        .eq('teacher_id', t.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      setCohorts(ch || []);
      if (ch && ch.length > 0) setSelectedCohort(ch[0].id);

      // 내 전공 배정된 학생
      const { data: st } = await supabase
        .from('students')
        .select('*')
        .eq('department_id', t.department_id)
        .order('name');
      setStudents(st || []);

      // 아직 전공 배정 안된 학생
      const { data: unassigned } = await supabase
        .from('students')
        .select('*')
        .is('department_id', null)
        .order('created_at', { ascending: false });
      setAllUsers(unassigned || []);

      setLoading(false);
    }
    load();
  }, []);

  async function assignStudent(studentId: string) {
    if (!selectedCohort || !teacher) return;
    const { error } = await supabase.from('students').update({
      department_id: teacher.department_id,
      cohort_id: selectedCohort,
    }).eq('id', studentId);

    if (!error) {
      setMsg('✅ 학생이 배정되었습니다.');
      // 목록 갱신
      const { data: st } = await supabase.from('students').select('*').eq('department_id', teacher.department_id).order('name');
      setStudents(st || []);
      const { data: unassigned } = await supabase.from('students').select('*').is('department_id', null).order('created_at', { ascending: false });
      setAllUsers(unassigned || []);
      setTimeout(() => setMsg(''), 3000);
    }
  }

  async function removeStudent(studentId: string) {
    if (!confirm('이 학생의 전공 배정을 해제하시겠습니까?')) return;
    await supabase.from('students').update({ department_id: null, cohort_id: null }).eq('id', studentId);
    setStudents(prev => prev.filter(s => s.id !== studentId));
    const { data: unassigned } = await supabase.from('students').select('*').is('department_id', null);
    setAllUsers(unassigned || []);
  }

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-black text-slate-900 dark:text-white">학생 관리</h1>

      {msg && <p className="text-center text-sm font-bold text-emerald-600 bg-emerald-50 py-2.5 rounded-2xl">{msg}</p>}

      {/* 배정 안된 학생 목록 */}
      {allUsers.length > 0 && (
        <div className="card p-5">
          <h2 className="font-black text-slate-800 dark:text-white mb-1">
            신규 가입자 ({allUsers.length}명)
          </h2>
          <p className="text-xs text-slate-400 mb-4">전공이 아직 배정되지 않은 학생입니다</p>

          {cohorts.length === 0 ? (
            <div className="bg-amber-50 dark:bg-amber-950 p-3 rounded-xl text-xs text-amber-700 dark:text-amber-300 font-semibold mb-3">
              ⚠️ 먼저 기수를 생성해주세요 (기수 관리 메뉴)
            </div>
          ) : (
            <select
              value={selectedCohort}
              onChange={e => setSelectedCohort(e.target.value)}
              className="input-field mb-3"
            >
              {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}

          <div className="space-y-2">
            {allUsers.map(u => (
              <div key={u.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div>
                  <p className="font-bold text-sm dark:text-white">{u.name}</p>
                  <p className="text-xs text-slate-400">{new Date(u.created_at).toLocaleDateString('ko-KR')} 가입</p>
                </div>
                <button
                  onClick={() => assignStudent(u.id)}
                  disabled={!selectedCohort}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-xs font-bold rounded-xl disabled:opacity-40 active:scale-95 transition-all"
                >
                  <UserPlus size={13} /> 배정
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 내 반 학생 목록 */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-black text-slate-800 dark:text-white">
            {teacher?.department?.name} 학생 ({students.length}명)
          </h2>
        </div>

        <div className="relative mb-4">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input-field pl-10"
            placeholder="이름으로 검색"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {filteredStudents.length === 0 ? (
          <p className="text-center text-slate-400 py-8 text-sm">학생이 없습니다</p>
        ) : (
          <div className="space-y-2">
            {filteredStudents.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div>
                  <p className="font-bold text-sm dark:text-white">{s.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-brand-400 font-medium">{getLevelLabel(s.total_attempts)}</span>
                    <span className="text-xs text-slate-400">최고 {s.high_score}점</span>
                    <span className="text-xs text-slate-400">총 {s.total_attempts}문제</span>
                  </div>
                </div>
                <button
                  onClick={() => removeStudent(s.id)}
                  className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
