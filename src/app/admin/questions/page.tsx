'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Question, UploadPayload, ExamType } from '@/types';
import { Upload, CheckCircle, XCircle, Trash2, Eye, EyeOff, AlertTriangle } from 'lucide-react';

const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  past_exam: '📚 기출문제',
  mock: '✏️ 모의고사',
  crash: '⚡ Crash Test',
};

// JSON 포맷 검증
function validatePayload(data: any): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data || !Array.isArray(data.questions)) {
    return { ok: false, errors: ['questions 배열이 없습니다.'] };
  }
  data.questions.forEach((q: any, i: number) => {
    const n = i + 1;
    if (!q.category)        errors.push(`[${n}번] category 없음`);
    if (!q.question_text)   errors.push(`[${n}번] question_text 없음`);
    if (!Array.isArray(q.options) || q.options.length !== 4)
                            errors.push(`[${n}번] options는 4개여야 합니다`);
    if (typeof q.answer_index !== 'number' || q.answer_index < 0 || q.answer_index > 3)
                            errors.push(`[${n}번] answer_index는 0~3이어야 합니다`);
  });
  return { ok: errors.length === 0, errors };
}

export default function QuestionsPage() {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [teacher, setTeacher] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);

  // 업로드 폼 상태
  const [uploadDept, setUploadDept] = useState('');
  const [uploadType, setUploadType] = useState<ExamType>('past_exam');
  const [isCommon, setIsCommon] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<UploadPayload | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string>('');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: t } = await supabase
        .from('teachers')
        .select('*, department:departments(*)')
        .eq('user_id', user!.id)
        .single();
      setTeacher(t);

      // 선생님 전공에 맞는 전공 목록
      const { data: depts } = await supabase
        .from('departments')
        .select('*')
        .eq('is_active', true);
      // 미용 선생님이면 공통(미용) + 세부전공 모두 표시, 제품디자인이면 본인것만
      const filtered = (depts || []).filter((d: any) => {
        if (!t) return false;
        const myDept = t.department;
        if (myDept.parent_id === null && myDept.slug !== 'beauty') {
          // 제품디자인 같은 단일 전공
          return d.id === myDept.id;
        }
        // 미용 계열
        return d.id === myDept.id || d.parent_id === myDept.parent_id || d.parent_id === myDept.id;
      });
      setDepartments(filtered.length > 0 ? filtered : depts || []);
      if (filtered.length > 0) setUploadDept(filtered[0].id);

      // 내가 올린 문제 목록
      const { data: qs } = await supabase
        .from('questions')
        .select('*')
        .eq('uploaded_by', t?.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setQuestions(qs || []);
    }
    load();
  }, []);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParsed(null);
    setParseErrors([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        const { ok, errors } = validatePayload(data);
        if (ok) {
          setParsed(data);
        } else {
          setParseErrors(errors);
        }
      } catch {
        setParseErrors(['JSON 파싱 오류. 파일 형식을 확인해주세요.']);
      }
    };
    reader.readAsText(file);
  }

  async function handleUpload() {
    if (!parsed || !teacher || !uploadDept) return;
    setUploading(true);
    setUploadResult('');

    const rows = parsed.questions.map(q => ({
      department_id: uploadDept,
      is_common: isCommon,
      exam_type: uploadType,
      category: q.category,
      question_text: q.question_text,
      options: q.options,
      answer_index: q.answer_index,
      explanation: q.explanation || null,
      image_url: q.image_url || null,
      uploaded_by: teacher.id,
      is_active: true,
    }));

    const { error } = await supabase.from('questions').insert(rows);

    if (error) {
      setUploadResult(`❌ 업로드 실패: ${error.message}`);
    } else {
      setUploadResult(`✅ ${rows.length}문제가 성공적으로 업로드되었습니다!`);
      setParsed(null);
      setFileName('');
      if (fileRef.current) fileRef.current.value = '';

      // 목록 갱신
      const { data: qs } = await supabase
        .from('questions').select('*').eq('uploaded_by', teacher?.id)
        .order('created_at', { ascending: false }).limit(50);
      setQuestions(qs || []);
    }
    setUploading(false);
  }

  async function toggleActive(q: Question) {
    await supabase.from('questions').update({ is_active: !q.is_active }).eq('id', q.id);
    setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, is_active: !x.is_active } : x));
  }

  async function deleteQuestion(id: string) {
    if (!confirm('이 문제를 삭제하시겠습니까?')) return;
    await supabase.from('questions').delete().eq('id', id);
    setQuestions(prev => prev.filter(x => x.id !== id));
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-black text-slate-900 dark:text-white">문제 관리</h1>

      {/* JSON 업로드 폼 */}
      <div className="card p-5 space-y-4">
        <h2 className="font-black text-slate-800 dark:text-white flex items-center gap-2">
          <Upload size={18} /> 문제 업로드
        </h2>

        {/* 전공 선택 */}
        <div>
          <label className="text-xs font-bold text-slate-500 mb-1.5 block">전공 / 과목</label>
          <select
            value={uploadDept}
            onChange={e => setUploadDept(e.target.value)}
            className="input-field"
          >
            {departments.map((d: any) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* 유형 선택 */}
        <div>
          <label className="text-xs font-bold text-slate-500 mb-1.5 block">시험 유형</label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(EXAM_TYPE_LABELS) as ExamType[]).map(t => (
              <button
                key={t}
                onClick={() => setUploadType(t)}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                  uploadType === t
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {EXAM_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* 공통 여부 (미용 계열만: slug가 beauty-로 시작하면 표시) */}
        {teacher?.department?.slug?.startsWith('beauty-') && (
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setIsCommon(!isCommon)}
              className={`w-12 h-6 rounded-full transition-colors ${isCommon ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-700'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform m-0.5 ${isCommon ? 'translate-x-6' : ''}`} />
            </div>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              미용 공통 과목 (공중위생관리학, 화장품학 등)
            </span>
          </label>
        )}

        {/* 파일 선택 */}
        <div>
          <label className="text-xs font-bold text-slate-500 mb-1.5 block">JSON 파일</label>
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center cursor-pointer hover:border-brand-400 transition-colors"
          >
            <div className="text-3xl mb-2">📂</div>
            <p className="text-sm font-semibold text-slate-500">
              {fileName || 'JSON 파일을 선택하세요'}
            </p>
            <p className="text-xs text-slate-400 mt-1">클릭하여 파일 선택</p>
            <input ref={fileRef} type="file" accept=".json" onChange={handleFile} className="hidden" />
          </div>
        </div>

        {/* 파싱 에러 */}
        {parseErrors.length > 0 && (
          <div className="bg-rose-50 dark:bg-rose-950 border border-rose-200 dark:border-rose-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm mb-2">
              <AlertTriangle size={16} /> 파일 오류
            </div>
            {parseErrors.map((e, i) => <p key={i} className="text-xs text-rose-500">{e}</p>)}
          </div>
        )}

        {/* 파싱 성공 미리보기 */}
        {parsed && (
          <div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm mb-1">
              <CheckCircle size={16} /> 파일 확인 완료
            </div>
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              <strong>{parsed.questions.length}문제</strong>가 감지되었습니다.
            </p>
            <p className="text-xs text-emerald-600 mt-0.5">
              카테고리: {[...new Set(parsed.questions.map(q => q.category))].join(', ')}
            </p>
          </div>
        )}

        {uploadResult && (
          <p className={`text-sm font-bold text-center py-3 rounded-2xl ${
            uploadResult.startsWith('✅')
              ? 'bg-emerald-50 text-emerald-600'
              : 'bg-rose-50 text-rose-500'
          }`}>{uploadResult}</p>
        )}

        <button
          onClick={handleUpload}
          disabled={!parsed || uploading}
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {uploading ? '업로드 중...' : `${parsed?.questions.length || 0}문제 업로드`}
        </button>
      </div>

      {/* JSON 포맷 가이드 */}
      <div className="card p-5">
        <h2 className="font-black text-slate-800 dark:text-white mb-3">📋 JSON 파일 형식 가이드</h2>
        <pre className="text-xs bg-slate-900 text-green-400 p-4 rounded-2xl overflow-x-auto leading-relaxed">
{`{
  "questions": [
    {
      "category": "헤어미용",
      "question_text": "문제 내용을 입력하세요",
      "options": ["선택1", "선택2", "선택3", "선택4"],
      "answer_index": 2,
      "explanation": "해설을 입력하세요 (선택)"
    }
  ]
}`}
        </pre>
        <div className="mt-3 space-y-1 text-xs text-slate-500">
          <p>• <strong>answer_index</strong>: 0부터 시작 (1번=0, 2번=1, 3번=2, 4번=3)</p>
          <p>• <strong>explanation</strong>: 해설 (없어도 됨)</p>
          <p>• 한 파일에 몇 문제든 가능, 여러 번 나눠서 올려도 누적됨</p>
        </div>
      </div>

      {/* 내가 올린 문제 목록 */}
      <div className="card p-5">
        <h2 className="font-black text-slate-800 dark:text-white mb-4">
          내가 올린 문제 ({questions.length})
        </h2>
        {questions.length === 0 ? (
          <p className="text-center text-slate-400 py-6 text-sm">아직 올린 문제가 없습니다</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto no-scrollbar">
            {questions.map(q => (
              <div key={q.id}
                className={`p-3 rounded-xl border flex items-start gap-3 ${
                  q.is_active
                    ? 'border-slate-100 dark:border-slate-700'
                    : 'border-rose-100 dark:border-rose-900/30 opacity-50'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-lg font-medium">
                      {q.category}
                    </span>
                    <span className="text-xs text-slate-400">{EXAM_TYPE_LABELS[q.exam_type]}</span>
                    {q.is_common && <span className="text-xs text-brand-400">공통</span>}
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 truncate font-medium">
                    {q.question_text}
                  </p>
                </div>
                <div className="flex gap-1 flex-none">
                  <button onClick={() => toggleActive(q)} className="p-1.5 text-slate-400 hover:text-brand-500 transition-colors">
                    {q.is_active ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                  <button onClick={() => deleteQuestion(q.id)} className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
