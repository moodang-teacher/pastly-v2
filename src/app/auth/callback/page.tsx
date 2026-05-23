'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AuthCallbackPage() {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState('로그인 처리 중...');
  const [debug, setDebug] = useState('');

  useEffect(() => {
    async function handleCallback() {
      try {
        const fullUrl = window.location.href;
        const params = new URLSearchParams(window.location.search);
        const hash = window.location.hash;
        const code = params.get('code');

        setDebug(`URL: ${fullUrl}\ncode: ${code ? 'yes' : 'no'}\nhash: ${hash ? 'yes' : 'no'}`);

        // 1) PKCE 플로우: code 파라미터가 있는 경우
        if (code) {
          setStatus('인증 코드 교환 중...');
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setDebug(prev => prev + `\nexchangeCode error: ${error.message}`);
            setStatus(`오류: ${error.message}`);
            return;
          }
          if (data.session) {
            setStatus('로그인 성공! 이동 중...');
            router.push('/home');
            router.refresh();
            return;
          }
        }

        // 2) Hash 기반 implicit 플로우
        if (hash && hash.includes('access_token')) {
          setStatus('토큰 처리 중...');
          // Supabase 클라이언트가 hash를 자동으로 처리할 때까지 대기
          await new Promise(r => setTimeout(r, 1500));
        }

        // 3) 세션 확인
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        setDebug(prev => prev + `\nsession: ${session ? 'yes' : 'no'}${sessionError ? '\nsessionError: ' + sessionError.message : ''}`);

        if (session) {
          setStatus('로그인 성공! 이동 중...');
          router.push('/home');
          router.refresh();
          return;
        }

        // 4) onAuthStateChange로 마지막 시도
        setStatus('세션 대기 중...');
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (session) {
            subscription.unsubscribe();
            router.push('/home');
            router.refresh();
          }
        });

        // 5초 후에도 안 되면 실패 처리
        setTimeout(() => {
          subscription.unsubscribe();
          setStatus('로그인 실패. 아래 디버그 정보를 개발자에게 전달하세요.');
        }, 5000);

      } catch (err: any) {
        setDebug(prev => prev + `\ncatch error: ${err.message}`);
        setStatus('처리 중 오류 발생');
      }
    }

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
      <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-500 font-semibold text-sm">{status}</p>
      {debug && (
        <pre className="mt-6 p-4 bg-slate-900 text-green-400 text-xs rounded-2xl max-w-sm w-full overflow-x-auto whitespace-pre-wrap">
          {debug}
        </pre>
      )}
    </div>
  );
}
