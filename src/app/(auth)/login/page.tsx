'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Eye, EyeOff, LogIn } from 'lucide-react';

interface Department {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [deptId, setDeptId] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 전공 목록 로드 (미용 부모 제외, 실제 선택 가능한 전공만)
  useEffect(() => {
    async function loadDepts() {
      const { data } = await supabase
        .from('departments')
        .select('*')
        .eq('is_active', true)
        .order('name');
      // 미용(부모) 제외 - slug가 'beauty'인 것만 제외
      const filtered = (data || []).filter((d: Department) => d.slug !== 'beauty');
      setDepartments(filtered);
      if (filtered.length > 0) setDeptId(filtered[0].id);
    }
    loadDepts();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (tab === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
        router.push('/home');
        router.refresh();
      } else {
        if (!name.trim()) throw new Error('이름을 입력해주세요.');
        if (!deptId) throw new Error('전공을 선택해주세요.');
        if (password.length < 6) throw new Error('비밀번호는 6자 이상이어야 합니다.');

        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw new Error(error.message);
        if (!data.user) throw new Error('회원가입 중 오류가 발생했습니다.');

        // 학생 프로필 생성 (전공 포함, 기수는 선생님이 배정)
        await supabase.from('students').insert({
          user_id: data.user.id,
          name: name.trim(),
          department_id: deptId,
          total_attempts: 0,
          high_score: 0,
        });

        alert('회원가입이 완료되었습니다!\n선생님께 기수 배정을 요청하세요.');
        setTab('login');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    const redirectTo = process.env.NODE_ENV === 'development'
      ? `${window.location.origin}/auth/callback`
      : `https://pastly-v2.vercel.app/auth/callback`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) {
      setError('구글 로그인에 실패했습니다.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-brand-50 to-slate-100 dark:from-slate-950 dark:to-brand-950">
      <div className="w-full max-w-sm animate-slide-up">
        {/* 로고 */}
        <div className="text-center mb-10">
          <img
            src="https://moodang-teacher.github.io/pastly/images/pastly_logo.png"
            alt="Pastly"
            className="h-10 w-auto object-contain mx-auto mb-3"
          />
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">필기시험 마스터</p>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-6">
          {(['login', 'signup'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); }}
              className={`flex-1 py-2.5 rounded-xl font-black text-sm transition-all ${
                tab === t
                  ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {t === 'login' ? '로그인' : '회원가입'}
            </button>
          ))}
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {tab === 'signup' && (
            <>
              <input
                className="input-field"
                placeholder="이름 (실명)"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
              {/* 전공 선택 */}
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block px-1">
                  전공 선택
                </label>
                <select
                  value={deptId}
                  onChange={e => setDeptId(e.target.value)}
                  className="input-field"
                  required
                >
                  <option value="">전공을 선택하세요</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <input
            className="input-field"
            type="email"
            placeholder="이메일"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <div className="relative">
            <input
              className="input-field pr-12"
              type={showPw ? 'text' : 'password'}
              placeholder="비밀번호 (6자 이상)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
            >
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && (
            <p className="text-rose-500 text-sm font-semibold text-center bg-rose-50 dark:bg-rose-950 py-2 px-4 rounded-xl">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-primary flex items-center justify-center gap-2">
            <LogIn size={18} />
            {loading ? '처리 중...' : tab === 'login' ? '로그인' : '회원가입'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
          <span className="text-slate-400 text-xs font-semibold">또는</span>
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
        </div>

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="btn-secondary flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          구글 계정으로 로그인
        </button>

        <p className="text-center text-xs text-slate-400 mt-6 font-medium">
          선생님 계정은 관리자에게 문의하세요
        </p>
      </div>
    </div>
  );
}
