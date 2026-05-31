'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X } from 'lucide-react';

export default function ChangePasswordModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const supabase = createClient();
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  if (!isOpen) return null;

  function reset() {
    setNewPw('');
    setConfirmPw('');
    setMsg('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit() {
    if (newPw.length < 6) return setMsg('❌ 비밀번호는 6자 이상이어야 합니다.');
    if (newPw !== confirmPw) return setMsg('❌ 비밀번호가 일치하지 않습니다.');
    setLoading(true);
    setMsg('');
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setLoading(false);
    if (error) {
      setMsg(`❌ ${error.message}`);
    } else {
      setMsg('✅ 비밀번호가 변경되었습니다.');
      setTimeout(() => handleClose(), 1500);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/50">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-black text-slate-900 dark:text-white">비밀번호 변경</h2>
          <button onClick={handleClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <input
            type="password"
            className="input-field"
            placeholder="새 비밀번호 (6자 이상)"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
          />
          <input
            type="password"
            className="input-field"
            placeholder="새 비밀번호 확인"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        {msg && (
          <p className={`mt-3 text-sm font-bold text-center py-2.5 rounded-2xl ${
            msg.startsWith('✅')
              ? 'bg-emerald-50 text-emerald-600'
              : 'bg-rose-50 text-rose-500'
          }`}>
            {msg}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="btn-primary mt-4 disabled:opacity-40"
        >
          {loading ? '변경 중...' : '변경하기'}
        </button>
      </div>
    </div>
  );
}
