import { createClient } from '@/lib/supabase/server';

export default async function AdminDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: teacher } = await supabase
    .from('teachers')
    .select('*, department:departments(*)')
    .eq('user_id', user!.id)
    .single();

  // 내 반 통계
  const { data: cohorts } = await supabase
    .from('cohorts')
    .select('*, students(count)')
    .eq('teacher_id', teacher.id)
    .eq('is_active', true);

  const { count: questionCount } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .eq('uploaded_by', teacher.id)
    .eq('is_active', true);

  const { count: totalStudents } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true })
    .eq('department_id', teacher.department_id)
    .in('cohort_id', (cohorts || []).map((c: any) => c.id));

  const stats = [
    { label: '내가 올린 문제', value: questionCount || 0, unit: '문제', color: 'brand' },
    { label: '담당 학생', value: totalStudents || 0, unit: '명', color: 'emerald' },
    { label: '활성 기수', value: (cohorts || []).length, unit: '개', color: 'amber' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">대시보드</h1>
        <p className="text-slate-500 text-sm mt-1">
          {teacher?.department?.name} | {teacher?.name} 선생님
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map(s => (
          <div key={s.label} className="card p-4 text-center">
            <div className={`text-2xl font-black text-${s.color}-600 dark:text-${s.color}-400`}>
              {s.value}
            </div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">{s.unit}</div>
            <div className="text-xs text-slate-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 빠른 메뉴 */}
      <div className="card p-5 space-y-3">
        <h2 className="font-black text-slate-800 dark:text-white">빠른 메뉴</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: '/admin/questions', emoji: '📤', label: '문제 업로드', desc: 'JSON 파일로 문제 추가' },
            { href: '/admin/students',  emoji: '👥', label: '학생 등록',   desc: '학생 추가 및 관리' },
            { href: '/admin/cohorts',   emoji: '📅', label: '기수 관리',   desc: '기수 생성 및 전환' },
            { href: '/admin/reset',     emoji: '⚠️', label: '초기화',      desc: '데이터 초기화' },
          ].map(m => (
            <a key={m.href} href={m.href}
              className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors group">
              <div className="text-2xl mb-2">{m.emoji}</div>
              <div className="font-bold text-sm text-slate-800 dark:text-white group-hover:text-brand-600">{m.label}</div>
              <div className="text-xs text-slate-400 mt-0.5">{m.desc}</div>
            </a>
          ))}
        </div>
      </div>

      {/* 활성 기수 목록 */}
      {cohorts && cohorts.length > 0 && (
        <div className="card p-5">
          <h2 className="font-black text-slate-800 dark:text-white mb-3">활성 기수</h2>
          <div className="space-y-2">
            {cohorts.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <span className="font-semibold text-sm dark:text-white">{c.name}</span>
                <span className="text-xs text-slate-400">{(c.students as any)?.[0]?.count || 0}명</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
