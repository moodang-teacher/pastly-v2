'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Department {
  id: string;
  name: string;
  slug: string;
}

export default function SelectDeptPage() {
  const router = useRouter();
  const supabase = createClient();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptId, setDeptId] = useState('');
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

      // 전공 목록
      const { data: depts } = await supabase
        .from('departments')
        .select('*')
        .eq('is_active', true)
        .neq('slug', 'beauty')
        .order('name');
      setDepartments(depts || []);
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    if (!deptId) return;
    if (!confirmed) {
      const dept = departments.find(d => d.id === deptId);
      if (!confirm(`전공: ${dept?.name}\n\n이 전공으로 설정하시겠습니까?\n변경은 선생님을 통해서만 가능합니다.`)) return;
      setConfirmed(true);
    }
    setSaving(true);
    await supabase.from('students').update({ department_id: deptId }).eq('id', studentId);
    router.push('/home');
    router.refresh();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const selectedDept = departments.find(d => d.id === deptId);

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
          <h2 className="text-xl font-black text-slate-900 dark:text-white">전공을 선택해주세요</h2>
          <p className="text-sm text-slate-500 mt-1">
            시험 문제와 랭킹이 전공별로 분리됩니다
          </p>
        </div>

        {/* 전공 선택 버튼 목록 */}
        <div className="space-y-2 mb-6">
          {departments.map(d => (
            <button
              key={d.id}
              onClick={() => setDeptId(d.id)}
              className={`w-full p-4 rounded-2xl border-2 text-left font-bold text-sm transition-all active:scale-[0.98] ${
                deptId === d.id
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                  : 'border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{d.name}</span>
                {deptId === d.id && <span className="text-brand-500">✓</span>}
              </div>
            </button>
          ))}
        </div>

        {/* 경고 문구 */}
        {!deptId && (
          <p className="text-center text-rose-500 text-xs font-bold mb-4 bg-rose-50 dark:bg-rose-950/30 py-2.5 rounded-xl">
            ⚠️ 전공을 선택하지 않으면 시험을 볼 수 없습니다
          </p>
        )}

        {/* 확인 메시지 */}
        {deptId && (
          <p className="text-center text-emerald-600 text-xs font-bold mb-4 bg-emerald-50 dark:bg-emerald-950/30 py-2.5 rounded-xl">
            ✓ {selectedDept?.name} — 이 전공으로 가입합니다
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={!deptId || saving}
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? '저장 중...' : '전공 선택 완료'}
        </button>

        <p className="text-center text-xs text-slate-400 mt-4">
          가입 후 전공 변경은 선생님에게 문의하세요
        </p>
      </div>
    </div>
  );
}
