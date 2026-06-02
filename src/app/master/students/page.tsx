'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getLevelLabel } from '@/types';
import { Search } from 'lucide-react';
import LoadingScreen from '@/components/LoadingScreen';
import { useSearchParams } from 'next/navigation';

export default function MasterStudentsPage() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const initialDept = searchParams.get('dept') || '';

  const [departments, setDepartments] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState(initialDept);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const { data: depts } = await supabase
        .from('departments')
        .select('id, name, slug')
        .neq('slug', 'beauty')
        .eq('is_active', true)
        .order('name');
      setDepartments(depts || []);
      await loadStudents(initialDept);
      setLoading(false);
    }
    init();
  }, []);

  async function loadStudents(deptId: string) {
    setLoading(true);

    // master 계정의 user_id 목록 조회
    const { data: masters } = await supabase
      .from('teachers')
      .select('user_id')
      .eq('is_master', true);
    const masterUserIds = (masters || []).map((m: any) => m.user_id);

    let query = supabase
      .from('students')
      .select('*, department:departments(name), cohort:cohorts(name)')
      .order('name');

    if (deptId) query = query.eq('department_id', deptId);
    if (masterUserIds.length > 0) {
      query = query.not('user_id', 'in', `(${masterUserIds.join(',')})`);
    }

    const { data } = await query;
    setStudents(data || []);
    setLoading(false);
  }

  function handleDeptChange(deptId: string) {
    setSelectedDept(deptId);
    loadStudents(deptId);
  }

  const filtered = students.filter((s: any) =>
    s.name.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) return <LoadingScreen />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">전체 학생</h1>
        <p className="text-slate-500 text-sm mt-1">총 {students.length}명</p>
      </div>

      {/* 필터 */}
      <div className="flex gap-2">
        <select
          value={selectedDept}
          onChange={(e) => handleDeptChange(e.target.value)}
          className="input-field flex-1"
        >
          <option value="">전체 전공</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input-field"
          style={{ paddingLeft: '3rem' }}
          placeholder="이름으로 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* 학생 목록 */}
      <div className="card p-5">
        {filtered.length === 0 ? (
          <p className="text-center text-slate-400 py-8 text-sm">학생이 없습니다</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((s: any) => (
              <div key={s.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm dark:text-white">{s.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-rose-500 font-medium">
                        {s.department?.name}
                      </span>
                      <span className="text-xs text-brand-400 font-medium">
                        {getLevelLabel(s.total_attempts)}
                      </span>
                      {s.cohort && (
                        <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded-lg">
                          {s.cohort.name}
                        </span>
                      )}
                      {!s.cohort_id && (
                        <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-600 px-1.5 py-0.5 rounded-lg">
                          미배정
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-700 dark:text-slate-200">{s.high_score}점</p>
                    <p className="text-xs text-slate-400">{s.total_attempts}문제</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
