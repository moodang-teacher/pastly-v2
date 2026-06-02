import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function MasterDashboard() {
  const supabase = await createClient();

  const [{ data: departments }, { data: teachers }, { count: totalStudents }, { count: totalCohorts }] =
    await Promise.all([
      supabase.from('departments').select('id, name, slug').neq('slug', 'beauty').eq('is_active', true).order('name'),
      supabase.from('teachers').select('id, name, department_id, department:departments(name)'),
      supabase.from('students').select('*', { count: 'exact', head: true }),
      supabase.from('cohorts').select('*', { count: 'exact', head: true }).eq('is_active', true),
    ]);

  const deptStats = await Promise.all(
    (departments || []).map(async (dept) => {
      const [{ count: studentCount }, { count: cohortCount }, { count: questionCount }] =
        await Promise.all([
          supabase.from('students').select('*', { count: 'exact', head: true }).eq('department_id', dept.id),
          supabase.from('cohorts').select('*', { count: 'exact', head: true }).eq('department_id', dept.id).eq('is_active', true),
          supabase.from('questions').select('*', { count: 'exact', head: true }).eq('department_id', dept.id).eq('is_active', true),
        ]);

      const deptTeachers = (teachers || []).filter((t) => t.department_id === dept.id);

      return { ...dept, studentCount, cohortCount, questionCount, teachers: deptTeachers };
    }),
  );

  const totalTeachers = (teachers || []).filter((t: any) => !t.is_master).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">전체 현황</h1>
        <p className="text-slate-500 text-sm mt-1">모든 전공의 데이터를 조회합니다</p>
      </div>

      {/* 전체 통계 */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '전체 학생', value: totalStudents ?? 0, unit: '명', color: 'brand' },
          { label: '활성 기수', value: totalCohorts ?? 0, unit: '개', color: 'emerald' },
          { label: '담당 선생님', value: totalTeachers, unit: '명', color: 'amber' },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <div className={`text-2xl font-black text-${s.color}-600 dark:text-${s.color}-400`}>
              {s.value}
            </div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">{s.unit}</div>
            <div className="text-xs text-slate-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 전공별 현황 */}
      <div className="space-y-3">
        <h2 className="font-black text-slate-800 dark:text-white">전공별 현황</h2>
        {deptStats.map((dept) => (
          <div key={dept.id} className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-black text-slate-800 dark:text-white">{dept.name}</h3>
                {dept.teachers.length > 0 && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {dept.teachers.map((t: any) => t.name).join(', ')} 선생님
                  </p>
                )}
              </div>
              <Link
                href={`/master/students?dept=${dept.id}`}
                className="text-xs font-bold px-3 py-1.5 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl transition-all active:scale-95"
              >
                학생 보기
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '학생', value: dept.studentCount ?? 0, unit: '명' },
                { label: '활성 기수', value: dept.cohortCount ?? 0, unit: '개' },
                { label: '문제 수', value: dept.questionCount ?? 0, unit: '문제' },
              ].map((s) => (
                <div key={s.label} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
                  <div className="text-lg font-black text-slate-800 dark:text-white">{s.value}</div>
                  <div className="text-xs text-slate-400">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
