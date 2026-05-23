'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getLevelLabel } from '@/types';
import { UserPlus, Trash2, Search, RefreshCw } from 'lucide-react';

export default function StudentsPage() {
  const supabase = createClient();
  const [teacher, setTeacher] = useState<any>(null);
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [myStudents, setMyStudents] = useState<any[]>([]);   // 내 전공 + 기수 배정된 학생
  const [waitingStudents, setWaitingStudents] = useState<any[]>([]); // 내 전공 + 기수 미배정
  const [search, setSearch] = useState('');
  const [selectedCohort, setSelectedCohort] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [allDepts, setAllDepts] = useState<any[]>([]);
  const [changingDeptId, setChangingDeptId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set()); // 체크된 대기 학생 ids

  async function loadAll(teacherData?: any) {
    const t = teacherData || teacher;
    if (!t) return;

    // 내 전공 활성 기수
    const { data: ch } = await supabase
      .from('cohorts')
      .select('*')
      .eq('teacher_id', t.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    setCohorts(ch || []);
    if (ch && ch.length > 0 && !selectedCohort) setSelectedCohort(ch[0].id);

    // 내 전공인데 기수 미배정 학생 (신규 가입자)
    const { data: waiting } = await supabase
      .from('students')
      .select('*')
      .eq('department_id', t.department_id)
      .is('cohort_id', null)
      .order('created_at', { ascending: false });
    setWaitingStudents(waiting || []);

    // 내 전공 + 기수 배정된 학생
    const { data: assigned } = await supabase
      .from('students')
      .select('*, cohort:cohorts(name)')
      .eq('department_id', t.department_id)
      .not('cohort_id', 'is', null)
      .order('name');
    setMyStudents(assigned || []);
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: t } = await supabase
        .from('teachers')
        .select('*, department:departments(*)')
        .eq('user_id', user!.id)
        .single();
      setTeacher(t);

      // 전공 변경용 전체 전공 목록
      const { data: depts } = await supabase
        .from('departments')
        .select('*')
        .eq('is_active', true)
        .neq('slug', 'beauty')
        .order('name');
      setAllDepts(depts || []);

      await loadAll(t);
      setLoading(false);
    }
    init();
  }, []);

  async function assignCohort(studentId: string) {
    if (!selectedCohort) return;
    const { error } = await supabase
      .from('students')
      .update({ cohort_id: selectedCohort })
      .eq('id', studentId);

    if (!error) {
      showMsg('✅ 기수가 배정되었습니다.');
      await loadAll();
    }
  }

  async function assignChecked() {
    if (!selectedCohort || checkedIds.size === 0) return;
    if (!confirm(`선택한 ${checkedIds.size}명을 배정하시겠습니까?`)) return;
    const ids = Array.from(checkedIds);
    const { error } = await supabase
      .from('students')
      .update({ cohort_id: selectedCohort })
      .in('id', ids);
    if (!error) {
      setCheckedIds(new Set());
      showMsg(`✅ ${ids.length}명 배정 완료`);
      await loadAll();
    }
  }

  async function assignAll() {
    if (!selectedCohort || waitingStudents.length === 0) return;
    if (!confirm(`${waitingStudents.length}명 전체를 선택한 기수에 배정하시겠습니까?`)) return;
    const ids = waitingStudents.map(s => s.id);
    const { error } = await supabase
      .from('students')
      .update({ cohort_id: selectedCohort })
      .in('id', ids);
    if (!error) {
      setCheckedIds(new Set());
      showMsg(`✅ ${ids.length}명 전체 배정 완료`);
      await loadAll();
    }
  }

  function toggleCheck(id: string) {
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleCheckAll() {
    if (checkedIds.size === waitingStudents.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(waitingStudents.map(s => s.id)));
    }
  }

  async function changeDept(studentId: string, newDeptId: string) {
    if (!newDeptId) return;
    await supabase.from('students')
      .update({ department_id: newDeptId, cohort_id: null })
      .eq('id', studentId);
    setChangingDeptId(null);
    showMsg('✅ 전공이 변경되었습니다. 해당 선생님 화면에 나타납니다.');
    await loadAll();
  }

  async function removeStudent(studentId: string) {
    if (!confirm('이 학생의 기수 배정을 해제하시겠습니까?')) return;
    await supabase.from('students').update({ cohort_id: null }).eq('id', studentId);
    await loadAll();
  }

  function showMsg(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(''), 3000);
  }

  const filteredStudents = myStudents.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">학생 관리</h1>
        <button onClick={() => loadAll()} className="p-2 text-slate-400 hover:text-brand-500 transition-colors">
          <RefreshCw size={18} />
        </button>
      </div>

      {msg && <p className="text-center text-sm font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 py-2.5 rounded-2xl">{msg}</p>}

      {/* 기수 미배정 학생 (내 전공으로 가입한 신규) */}
      {waitingStudents.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              {/* 전체 선택 체크박스 */}
              <input
                type="checkbox"
                checked={waitingStudents.length > 0 && checkedIds.size === waitingStudents.length}
                onChange={toggleCheckAll}
                className="w-4 h-4 rounded accent-brand-600 cursor-pointer"
              />
              <h2 className="font-black text-slate-800 dark:text-white">
                기수 배정 대기 ({waitingStudents.length}명)
              </h2>
            </div>
            <div className="flex gap-2">
              {checkedIds.size > 0 && (
                <button
                  onClick={assignChecked}
                  disabled={!selectedCohort}
                  className="text-xs font-bold text-brand-600 dark:text-brand-400 disabled:opacity-40"
                >
                  선택 {checkedIds.size}명 배정
                </button>
              )}
              {checkedIds.size === 0 && waitingStudents.length > 1 && (
                <button
                  onClick={assignAll}
                  disabled={!selectedCohort}
                  className="text-xs font-bold text-slate-400 disabled:opacity-40"
                >
                  전체 배정
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            {teacher?.department?.name} 전공으로 가입한 학생입니다
          </p>

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
            {waitingStudents.map(s => (
              <div key={s.id} className={`p-3 rounded-xl border transition-colors ${
                checkedIds.has(s.id)
                  ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-700'
                  : 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={checkedIds.has(s.id)}
                      onChange={() => toggleCheck(s.id)}
                      className="w-4 h-4 rounded accent-brand-600 cursor-pointer flex-none"
                    />
                    <div>
                      <p className="font-bold text-sm dark:text-white">{s.name}</p>
                      <p className="text-xs text-slate-400">{new Date(s.created_at).toLocaleDateString('ko-KR')} 가입</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setChangingDeptId(changingDeptId === s.id ? null : s.id)}
                      className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl active:scale-95 transition-all"
                    >
                      전공변경
                    </button>
                    <button
                      onClick={() => assignCohort(s.id)}
                      disabled={!selectedCohort}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-xs font-bold rounded-xl disabled:opacity-40 active:scale-95 transition-all"
                    >
                      <UserPlus size={13} /> 배정
                    </button>
                  </div>
                </div>
                {changingDeptId === s.id && (
                  <div className="mt-2 flex gap-2">
                    <select
                      className="input-field py-2 text-xs flex-1"
                      defaultValue=""
                      onChange={e => e.target.value && changeDept(s.id, e.target.value)}
                    >
                      <option value="">다른 전공 선택...</option>
                      {allDepts.filter(d => d.id !== teacher?.department_id).map((d: any) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 배정된 학생 목록 */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-black text-slate-800 dark:text-white">
            {teacher?.department?.name} 학생 ({myStudents.length}명)
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
          <p className="text-center text-slate-400 py-8 text-sm">
            {myStudents.length === 0 ? '배정된 학생이 없습니다' : '검색 결과가 없습니다'}
          </p>
        ) : (
          <div className="space-y-2">
            {filteredStudents.map(s => (
              <div key={s.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm dark:text-white">{s.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-brand-400 font-medium">{getLevelLabel(s.total_attempts)}</span>
                      <span className="text-xs text-slate-400">최고 {s.high_score}점</span>
                      <span className="text-xs text-slate-400">{s.total_attempts}문제</span>
                      {s.cohort && <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded-lg">{s.cohort.name}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-none">
                    <button
                      onClick={() => setChangingDeptId(changingDeptId === s.id ? null : s.id)}
                      className="px-2 py-1.5 text-slate-400 hover:text-brand-500 text-xs font-bold transition-colors"
                    >
                      전공
                    </button>
                    <button
                      onClick={() => removeStudent(s.id)}
                      className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                {/* 전공 변경 인라인 UI */}
                {changingDeptId === s.id && (
                  <div className="mt-2">
                    <select
                      className="input-field py-2 text-xs w-full"
                      defaultValue=""
                      onChange={e => e.target.value && changeDept(s.id, e.target.value)}
                    >
                      <option value="">다른 전공으로 변경...</option>
                      {allDepts.filter(d => d.id !== s.department_id).map((d: any) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
