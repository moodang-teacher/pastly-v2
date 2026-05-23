'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ResetOption {
  id: string;
  title: string;
  desc: string;
  detail: string;
  color: string;
  confirm1: string;
  confirm2?: string;
}

const RESET_OPTIONS: ResetOption[] = [
  {
    id: 'new_cohort',
    title: '🎓 새 학기 시작',
    desc: '학생 점수·레벨·오답 초기화 (문제 유지)',
    detail: '현재 기수의 학생 기록(점수, 레벨, 오답)을 초기화합니다. 문제 데이터는 그대로 유지됩니다.',
    color: 'amber',
    confirm1: '새 학기를 시작하면 현재 기수 학생의 점수, 레벨, 오답이 모두 초기화됩니다. 계속하시겠습니까?',
  },
  {
    id: 'student',
    title: '👤 개별 학생 초기화',
    desc: '특정 학생의 기록만 초기화',
    detail: '선택한 학생의 점수, 레벨, 오답을 초기화합니다.',
    color: 'orange',
    confirm1: '이 학생의 모든 기록을 초기화하시겠습니까?',
  },
  {
    id: 'all',
    title: '⚠️ 전체 초기화',
    desc: '모든 학생 기록 + 문제 삭제 (되돌릴 수 없음)',
    detail: '모든 학생의 기록과 내가 올린 문제를 전부 삭제합니다. 절대 되돌릴 수 없습니다.',
    color: 'rose',
    confirm1: '⚠️ 경고: 이 작업은 되돌릴 수 없습니다.\n내가 올린 모든 문제와 담당 학생 기록이 삭제됩니다.\n정말 진행하시겠습니까?',
    confirm2: '정말요? 마지막 확인입니다!',
  },
];

export default function ResetPage() {
  const supabase = createClient();
  const [teacher, setTeacher] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: t } = await supabase.from('teachers').select('*').eq('user_id', user!.id).single();
      setTeacher(t);
      const { data: st } = await supabase.from('students').select('id, name').eq('department_id', t.department_id).order('name');
      setStudents(st || []);
    }
    load();
  }, []);

  async function handleReset(option: ResetOption) {
    if (!confirm(option.confirm1)) return;
    if (option.confirm2 && !confirm(option.confirm2)) return;

    setLoading(true);
    setMsg('');

    try {
      if (option.id === 'new_cohort') {
        // 내 전공 학생들 점수/레벨/오답 초기화
        const { data: myStudents } = await supabase
          .from('students').select('id').eq('department_id', teacher.department_id);

        const ids = (myStudents || []).map((s: any) => s.id);
        if (ids.length > 0) {
          await supabase.from('students').update({ total_attempts: 0, high_score: 0 })
            .in('id', ids);
          await supabase.from('wrong_answers').delete().in('student_id', ids);
          await supabase.from('attempts').delete().in('student_id', ids);
        }
        setMsg(`✅ ${ids.length}명의 학생 기록이 초기화되었습니다.`);

      } else if (option.id === 'student') {
        if (!selectedStudent) { setMsg('❌ 학생을 선택해주세요.'); setLoading(false); return; }
        await supabase.from('students').update({ total_attempts: 0, high_score: 0 }).eq('id', selectedStudent);
        await supabase.from('wrong_answers').delete().eq('student_id', selectedStudent);
        await supabase.from('attempts').delete().eq('student_id', selectedStudent);
        setMsg('✅ 선택한 학생의 기록이 초기화되었습니다.');

      } else if (option.id === 'all') {
        const { data: myStudents } = await supabase.from('students').select('id').eq('department_id', teacher.department_id);
        const ids = (myStudents || []).map((s: any) => s.id);
        if (ids.length > 0) {
          await supabase.from('students').update({ total_attempts: 0, high_score: 0 }).in('id', ids);
          await supabase.from('wrong_answers').delete().in('student_id', ids);
          await supabase.from('attempts').delete().in('student_id', ids);
        }
        await supabase.from('questions').delete().eq('uploaded_by', teacher.id);
        setMsg('✅ 전체 초기화가 완료되었습니다.');
      }
    } catch (e: any) {
      setMsg(`❌ 오류: ${e.message}`);
    }

    setLoading(false);
    setTimeout(() => setMsg(''), 5000);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <AlertTriangle size={22} className="text-rose-500" />
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">초기화</h1>
      </div>
      <p className="text-sm text-slate-500">신중하게 사용하세요. 일부 작업은 되돌릴 수 없습니다.</p>

      {msg && (
        <p className={`text-center text-sm font-bold py-3 rounded-2xl ${
          msg.startsWith('✅') ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'
        }`}>{msg}</p>
      )}

      {RESET_OPTIONS.map(opt => (
        <div key={opt.id} className={`card p-5 border-${opt.color}-100 dark:border-${opt.color}-900/30`}>
          <h2 className="font-black text-slate-800 dark:text-white mb-1">{opt.title}</h2>
          <p className="text-sm text-slate-500 mb-1">{opt.desc}</p>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">{opt.detail}</p>

          {opt.id === 'student' && (
            <select
              value={selectedStudent}
              onChange={e => setSelectedStudent(e.target.value)}
              className="input-field mb-3"
            >
              <option value="">학생 선택...</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}

          <button
            onClick={() => handleReset(opt)}
            disabled={loading}
            className={`w-full py-3 rounded-2xl font-black text-sm transition-all active:scale-95 disabled:opacity-40
              ${opt.color === 'rose'
                ? 'bg-rose-500 text-white hover:bg-rose-600'
                : opt.color === 'amber'
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-orange-500 text-white hover:bg-orange-600'
              }`}
          >
            {loading ? '처리 중...' : opt.title}
          </button>
        </div>
      ))}
    </div>
  );
}
