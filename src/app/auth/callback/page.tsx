'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AuthCallbackPage() {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState('로그인 처리 중...');

  useEffect(() => {
    async function handleCallback() {
      try {
        // URL에서 code 파라미터 확인 (PKCE 플로우)
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setStatus('로그인 처리 중 오류가 발생했습니다.');
            setTimeout(() => router.push('/login?error=callback_failed'), 2000);
            return;
          }
        }

        // 세션 확인 (hash 기반 implicit flow 포함)
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          router.push('/home');
          router.refresh();
        } else {
          // 세션이 아직 없으면 잠시 대기 후 재확인
          await new Promise(r => setTimeout(r, 1000));
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (retrySession) {
            router.push('/home');
            router.refresh();
          } else {
            setStatus('로그인에 실패했습니다.');
            setTimeout(() => router.push('/login?error=no_session'), 2000);
          }
        }
      } catch (err) {
        setStatus('오류가 발생했습니다.');
        setTimeout(() => router.push('/login'), 2000);
      }
    }

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-500 font-semibold text-sm">{status}</p>
    </div>
  );
}
