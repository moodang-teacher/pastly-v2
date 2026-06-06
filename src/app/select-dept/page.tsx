'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import LoadingScreen from '@/components/LoadingScreen';

interface TeacherOption {
  id: string;
  name: string;
  department_id: string;
  department: { name: string; slug: string };
}

export default function SelectDeptPage() {
  const router = useRouter();
  const supabase = createClient();

  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [teacherId, setTeacherId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      // 이미 전공이 있으면 홈으로
      const { data: st } = await supabase
        .from('students')
        .select('id, department_id')
        .eq('user_id', user.id)
        .single();

      if (st?.department_id) { router.push('/home'); return; }

      // 학생 행이 없으면 생성
      if (!st) {
        const { data: newSt } = await supabase
          .from('students')
          .insert({
            user_id: user.id,
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || '학생',
            total_attempts: 0,
            high_score: 0,
          })
          .select()
          .single();
        setStudentId(newSt?.id || '');
      } else {
        setStudentId(st.id);
      }

      // 선생님 목록 (전공 정보 포함, 마스터 제외)
      const { data: ts } = await supabase
        .from('teachers')
        .select('id, name, department_id, department:departments(name, slug)')
        .eq('is_master', false);
      const filtered = (ts || [])
        .filter((t: any) => t.department?.[0]?.slug !== 'beauty')
        .map((t: any): TeacherOption => ({
          ...t,
          department: t.department?.[0] ?? { name: '', slug: '' },
        }));
      setTeachers(filtered);
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    if (!teacherId) return;
    if (!confirmed) {
      const t = teachers.find(x => x.id === teacherId);
      const displayName = t ? `${t.department.name}(${t.name} 선생님)` : '';
      if (!confirm(`과정: ${displayName}\n\n이 과정으로 설정하시겠습니까?\n변경은 선생님을 통해서만 가능합니다.`)) return;
      setConfirmed(true);
    }
    setSaving(true);
    const selected = teachers.find(x => x.id === teacherId);
    await supabase.from('students').update({
      department_id: selected!.department_id,
      teacher_id: teacherId,
    }).eq('id', studentId);
    router.push('/home');
    router.refresh();
  }

  if (loading) {
    return (
      <LoadingScreen />
    );
  }

  const selectedTeacher = teachers.find(t => t.id === teacherId);
  const selectedLabel = selectedTeacher
    ? `${selectedTeacher.department.name}(${selectedTeacher.name} 선생님)`
    : '';

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-brand-50 to-slate-100 dark:from-slate-950 dark:to-brand-950">
      <div className="w-full max-w-sm animate-slide-up">

        {/* 헤더 */}
        <div className="text-center mb-8">
          <img
            src="/icons/pastly.svg"
            alt="Pastly"
            className="h-10 w-auto object-contain mx-auto mb-4"
          />
          <h2 className="text-xl font-black text-slate-900 dark:text-white">과정을 선택해주세요</h2>
          <p className="text-sm text-slate-500 mt-1">
            시험 문제와 랭킹이 과정별로 분리됩니다
          </p>
        </div>

        {/* 기수(과정) 선택 버튼 목록 */}
        <div className="space-y-2 mb-6">
          {teachers.length === 0 ? (
            <p className="text-center text-slate-500 text-sm py-6">
              현재 모집 중인 과정이 없습니다.<br />선생님께 문의하세요.
            </p>
          ) : (
            teachers.map(t => {
              const label = `${t.department.name}(${t.name} 선생님)`;
              return (
                <button
                  key={t.id}
                  onClick={() => setTeacherId(t.id)}
                  className={`w-full p-4 rounded-2xl border-2 text-left font-bold text-sm transition-all active:scale-[0.98] ${
                    teacherId === t.id
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                      : 'border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{label}</span>
                    {teacherId === t.id && <span className="text-brand-500">✓</span>}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* 경고 문구 */}
        {!teacherId && teachers.length > 0 && (
          <p className="text-center text-rose-500 text-xs font-bold mb-4 bg-rose-50 dark:bg-rose-950/30 py-2.5 rounded-xl">
            ⚠️ 과정을 선택하지 않으면 시험을 볼 수 없습니다
          </p>
        )}

        {/* 확인 메시지 */}
        {teacherId && (
          <p className="text-center text-emerald-600 text-xs font-bold mb-4 bg-emerald-50 dark:bg-emerald-950/30 py-2.5 rounded-xl">
            ✓ {selectedLabel} — 이 과정으로 가입합니다
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={!teacherId || saving}
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? '저장 중...' : '과정 선택 완료'}
        </button>

        <p className="text-center text-xs text-slate-400 mt-4">
          가입 후 과정 변경은 선생님에게 문의하세요
        </p>
      </div>
    </div>
  );
}
