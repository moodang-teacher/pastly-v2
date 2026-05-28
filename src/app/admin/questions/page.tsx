'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Question, UploadPayload } from '@/types';
import {
	Upload,
	Trash2,
	Eye,
	EyeOff,
	AlertTriangle,
	CheckCircle,
	PenLine,
	ImagePlus,
	X,
} from 'lucide-react';

const EXAM_TYPE_LABELS: Record<string, string> = {
	past_exam: '📚 기출문제',
	mock: '✏️ 모의고사',
};

function validatePayload(data: any): { ok: boolean; errors: string[] } {
	const errors: string[] = [];
	if (!data || !Array.isArray(data.questions)) {
		return { ok: false, errors: ['questions 배열이 없습니다.'] };
	}
	data.questions.forEach((q: any, i: number) => {
		const n = i + 1;
		if (!q.category) errors.push(`[${n}번] category 없음`);
		if (!q.question_text) errors.push(`[${n}번] question_text 없음`);
		if (!Array.isArray(q.options) || q.options.length !== 4)
			errors.push(`[${n}번] options는 4개여야 합니다`);
		if (
			typeof q.answer_index !== 'number' ||
			q.answer_index < 0 ||
			q.answer_index > 3
		)
			errors.push(`[${n}번] answer_index는 0~3이어야 합니다`);
	});
	return { ok: errors.length === 0, errors };
}

// 이미지 압축
async function compressImage(file: File): Promise<Blob> {
	return new Promise((resolve) => {
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d')!;
		const img = new window.Image();
		img.onload = () => {
			const max = 1200;
			let { width, height } = img;
			if (width > max) {
				height = (height * max) / width;
				width = max;
			}
			canvas.width = width;
			canvas.height = height;
			ctx.drawImage(img, 0, 0, width, height);
			canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.85);
		};
		img.src = URL.createObjectURL(file);
	});
}

export default function QuestionsPage() {
	const supabase = createClient();
	const jsonFileRef = useRef<HTMLInputElement>(null);
	const imgFileRef = useRef<HTMLInputElement>(null);

	const [teacher, setTeacher] = useState<any>(null);
	const [departments, setDepartments] = useState<any[]>([]);
	const [questions, setQuestions] = useState<Question[]>([]);
	const [activeTab, setActiveTab] = useState<'json' | 'single'>('json');

	// JSON 업로드 상태
	const [uploadDept, setUploadDept] = useState('');
	const [uploadType, setUploadType] = useState('past_exam');
	const [isCommon, setIsCommon] = useState(false);
	const [fileName, setFileName] = useState('');
	const [parsed, setParsed] = useState<UploadPayload | null>(null);
	const [parseErrors, setParseErrors] = useState<string[]>([]);
	const [uploading, setUploading] = useState(false);
	const [uploadResult, setUploadResult] = useState('');

	// 1개 직접 입력 상태
	const [sCategory, setSCategory] = useState('');
	const [sQuestion, setSQuestion] = useState('');
	const [sOptions, setSOptions] = useState(['', '', '', '']);
	const [sAnswer, setSAnswer] = useState<number | null>(null);
	const [sExplanation, setSExplanation] = useState('');
	const [sExamType, setSExamType] = useState('past_exam');
	const [sDept, setSDept] = useState('');
	const [sIsCommon, setSIsCommon] = useState(false);
	const [sImageFile, setSImageFile] = useState<File | null>(null);
	const [sImagePreview, setSImagePreview] = useState('');
	const [sSaving, setSSaving] = useState(false);
	const [sSaveResult, setSSaveResult] = useState('');

	useEffect(() => {
		async function load() {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			const { data: t } = await supabase
				.from('teachers')
				.select('*, department:departments(*)')
				.eq('user_id', user!.id)
				.single();
			setTeacher(t);

			const { data: depts } = await supabase
				.from('departments')
				.select('*')
				.eq('is_active', true);
			const filtered = (depts || []).filter((d: any) => {
				if (!t) return false;
				const myDept = t.department;
				if (myDept.parent_id === null && myDept.slug !== 'beauty')
					return d.id === myDept.id;
				return (
					d.id === myDept.id ||
					d.parent_id === myDept.parent_id ||
					d.parent_id === myDept.id
				);
			});
			setDepartments(filtered.length > 0 ? filtered : depts || []);
			if (filtered.length > 0) {
				setUploadDept(filtered[0].id);
				setSDept(filtered[0].id);
			}

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

	// ── JSON 업로드 ──────────────────────────────────────
	function handleJsonFile(e: React.ChangeEvent<HTMLInputElement>) {
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
				if (ok) setParsed(data);
				else setParseErrors(errors);
			} catch {
				setParseErrors(['JSON 파싱 오류. 파일 형식을 확인해주세요.']);
			}
		};
		reader.readAsText(file);
	}

	async function handleJsonUpload() {
		if (!parsed || !teacher || !uploadDept) return;
		setUploading(true);
		setUploadResult('');
		const rows = parsed.questions.map((q) => ({
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
			setUploadResult(`✅ ${rows.length}문제 업로드 완료!`);
			setParsed(null);
			setFileName('');
			if (jsonFileRef.current) jsonFileRef.current.value = '';
			const { data: qs } = await supabase
				.from('questions')
				.select('*')
				.eq('uploaded_by', teacher?.id)
				.order('created_at', { ascending: false })
				.limit(50);
			setQuestions(qs || []);
		}
		setUploading(false);
	}

	// ── 1개 직접 입력 ────────────────────────────────────
	function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		setSImageFile(file);
		setSImagePreview(URL.createObjectURL(file));
	}

	function removeImage() {
		setSImageFile(null);
		setSImagePreview('');
		if (imgFileRef.current) imgFileRef.current.value = '';
	}

	async function uploadImageToStorage(
		file: File,
		teacherId: string,
	): Promise<string> {
		const compressed = await compressImage(file);
		const ext = 'jpg';
		const path = `${teacherId}/${Date.now()}.${ext}`;
		const { error } = await supabase.storage
			.from('question-images')
			.upload(path, compressed, { contentType: 'image/jpeg', upsert: false });
		if (error) throw new Error('이미지 업로드 실패: ' + error.message);
		const { data } = supabase.storage
			.from('question-images')
			.getPublicUrl(path);
		return data.publicUrl;
	}

	async function handleSingleSave() {
		if (!sCategory.trim()) return setSSaveResult('❌ 카테고리를 입력해주세요.');
		if (!sQuestion.trim()) return setSSaveResult('❌ 문제를 입력해주세요.');
		if (sOptions.some((o) => !o.trim()))
			return setSSaveResult('❌ 선택지 4개를 모두 입력해주세요.');
		if (sAnswer === null) return setSSaveResult('❌ 정답을 선택해주세요.');
		if (!sDept) return setSSaveResult('❌ 전공을 선택해주세요.');

		setSSaving(true);
		setSSaveResult('');

		try {
			let imageUrl: string | null = null;
			if (sImageFile) {
				setSSaveResult('🔄 이미지 업로드 중...');
				imageUrl = await uploadImageToStorage(sImageFile, teacher.id);
			}

			await supabase.from('questions').insert({
				department_id: sDept,
				is_common: sIsCommon,
				exam_type: sExamType,
				category: sCategory.trim(),
				question_text: sQuestion.trim(),
				options: sOptions.map((o) => o.trim()),
				answer_index: sAnswer,
				explanation: sExplanation.trim() || null,
				image_url: imageUrl,
				uploaded_by: teacher.id,
				is_active: true,
			});

			setSSaveResult('✅ 문제가 등록되었습니다!');
			// 폼 초기화
			setSCategory('');
			setSQuestion('');
			setSOptions(['', '', '', '']);
			setSAnswer(null);
			setSExplanation('');
			setSImageFile(null);
			setSImagePreview('');
			if (imgFileRef.current) imgFileRef.current.value = '';

			const { data: qs } = await supabase
				.from('questions')
				.select('*')
				.eq('uploaded_by', teacher?.id)
				.order('created_at', { ascending: false })
				.limit(50);
			setQuestions(qs || []);
		} catch (err: any) {
			setSSaveResult(`❌ ${err.message}`);
		}
		setSSaving(false);
	}

	async function toggleActive(q: Question) {
		const { error } = await supabase
			.from('questions')
			.update({ is_active: !q.is_active })
			.eq('id', q.id);

		if (error) {
			alert(`변경 실패: ${error.message}\n\ncode: ${error.code}`);
			return;
		}
		setQuestions((prev) =>
			prev.map((x) => (x.id === q.id ? { ...x, is_active: !x.is_active } : x)),
		);
	}

	async function deleteQuestion(id: string) {
		if (!confirm('이 문제를 삭제하시겠습니까?')) return;
		const { error } = await supabase.from('questions').delete().eq('id', id);
		if (error) {
			alert(`삭제 실패: ${error.message}`);
			return;
		}
		setQuestions((prev) => prev.filter((x) => x.id !== id));
	}

	return (
		<div className="space-y-6 animate-fade-in">
			<h1 className="text-2xl font-black text-slate-900 dark:text-white">
				문제 관리
			</h1>

			{/* 탭 전환 */}
			<div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
				{[
					{ key: 'json', label: '📂 JSON 일괄 업로드' },
					{ key: 'single', label: '✏️ 문제 1개 직접 입력' },
				].map((t) => (
					<button
						key={t.key}
						onClick={() => setActiveTab(t.key as any)}
						className={`flex-1 py-2.5 rounded-xl font-black text-sm transition-all ${
							activeTab === t.key
								? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm'
								: 'text-slate-500 dark:text-slate-400'
						}`}
					>
						{t.label}
					</button>
				))}
			</div>

			{/* ── JSON 업로드 탭 ── */}
			{activeTab === 'json' && (
				<div className="card p-5 space-y-4">
					<h2 className="font-black text-slate-800 dark:text-white flex items-center gap-2">
						<Upload size={18} /> JSON 일괄 업로드
					</h2>

					<div>
						<label className="text-xs font-bold text-slate-500 mb-1.5 block">
							전공 / 과목
						</label>
						<select
							value={uploadDept}
							onChange={(e) => setUploadDept(e.target.value)}
							className="input-field"
						>
							{departments.map((d: any) => (
								<option key={d.id} value={d.id}>
									{d.name}
								</option>
							))}
						</select>
					</div>

					<div>
						<label className="text-xs font-bold text-slate-500 mb-1.5 block">
							시험 유형
						</label>
						<div className="grid grid-cols-2 gap-2">
							{Object.keys(EXAM_TYPE_LABELS).map((t) => (
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

					{teacher?.department?.slug?.startsWith('beauty-') && (
						<label className="flex items-center gap-3 cursor-pointer">
							<div
								onClick={() => setIsCommon(!isCommon)}
								className={`w-12 h-6 rounded-full transition-colors ${isCommon ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-700'}`}
							>
								<div
									className={`w-5 h-5 bg-white rounded-full shadow transition-transform m-0.5 ${isCommon ? 'translate-x-6' : ''}`}
								/>
							</div>
							<span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
								미용 공통 과목
							</span>
						</label>
					)}

					<div
						onClick={() => jsonFileRef.current?.click()}
						className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center cursor-pointer hover:border-brand-400 transition-colors"
					>
						<div className="text-3xl mb-2">📂</div>
						<p className="text-sm font-semibold text-slate-500">
							{fileName || 'JSON 파일을 선택하세요'}
						</p>
						<p className="text-xs text-slate-400 mt-1">클릭하여 파일 선택</p>
						<input
							ref={jsonFileRef}
							type="file"
							accept=".json"
							onChange={handleJsonFile}
							className="hidden"
						/>
					</div>

					{parseErrors.length > 0 && (
						<div className="bg-rose-50 dark:bg-rose-950 border border-rose-200 rounded-2xl p-4">
							<div className="flex items-center gap-2 text-rose-600 font-bold text-sm mb-2">
								<AlertTriangle size={16} /> 파일 오류
							</div>
							{parseErrors.map((e, i) => (
								<p key={i} className="text-xs text-rose-500">
									{e}
								</p>
							))}
						</div>
					)}

					{parsed && (
						<div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 rounded-2xl p-4">
							<div className="flex items-center gap-2 text-emerald-600 font-bold text-sm mb-1">
								<CheckCircle size={16} /> 파일 확인 완료
							</div>
							<p className="text-sm text-emerald-700 dark:text-emerald-300">
								<strong>{parsed.questions.length}문제</strong> 감지됨
							</p>
							<p className="text-xs text-emerald-600 mt-0.5">
								카테고리:{' '}
								{[...new Set(parsed.questions.map((q) => q.category))].join(
									', ',
								)}
							</p>
						</div>
					)}

					{uploadResult && (
						<p
							className={`text-sm font-bold text-center py-3 rounded-2xl ${
								uploadResult.startsWith('✅')
									? 'bg-emerald-50 text-emerald-600'
									: 'bg-rose-50 text-rose-500'
							}`}
						>
							{uploadResult}
						</p>
					)}

					<button
						onClick={handleJsonUpload}
						disabled={!parsed || uploading}
						className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
					>
						{uploading
							? '업로드 중...'
							: `${parsed?.questions.length || 0}문제 업로드`}
					</button>

					{/* JSON 포맷 가이드 */}
					<details className="group">
						<summary className="text-xs font-bold text-slate-400 cursor-pointer hover:text-slate-600 list-none flex items-center gap-1">
							<span className="group-open:rotate-90 transition-transform inline-block">
								▶
							</span>{' '}
							JSON 형식 가이드 보기
						</summary>
						<pre className="mt-3 text-xs bg-slate-900 text-green-400 p-4 rounded-2xl overflow-x-auto leading-relaxed">
							{`{
  "questions": [
    {
      "category": "헤어미용",
      "question_text": "문제 내용",
      "options": ["선택1", "선택2", "선택3", "선택4"],
      "answer_index": 2,
      "explanation": "해설 (선택)"
    }
  ]
}`}
						</pre>
						<div className="mt-2 space-y-1 text-xs text-slate-500">
							<p>• answer_index: 1번=0, 2번=1, 3번=2, 4번=3</p>
							<p>• 이미지 있는 문제는 "직접 입력" 탭 사용</p>
						</div>
					</details>
				</div>
			)}

			{/* ── 1개 직접 입력 탭 ── */}
			{activeTab === 'single' && (
				<div className="card p-5 space-y-4">
					<h2 className="font-black text-slate-800 dark:text-white flex items-center gap-2">
						<PenLine size={18} /> 문제 1개 직접 입력
					</h2>

					{/* 전공 + 유형 */}
					<div className="grid grid-cols-2 gap-3">
						<div>
							<label className="text-xs font-bold text-slate-500 mb-1.5 block">
								전공
							</label>
							<select
								value={sDept}
								onChange={(e) => setSDept(e.target.value)}
								className="input-field"
							>
								{departments.map((d: any) => (
									<option key={d.id} value={d.id}>
										{d.name}
									</option>
								))}
							</select>
						</div>
						<div>
							<label className="text-xs font-bold text-slate-500 mb-1.5 block">
								유형
							</label>
							<select
								value={sExamType}
								onChange={(e) => setSExamType(e.target.value)}
								className="input-field"
							>
								{Object.keys(EXAM_TYPE_LABELS).map((t) => (
									<option key={t} value={t}>
										{EXAM_TYPE_LABELS[t]}
									</option>
								))}
							</select>
						</div>
					</div>

					{/* 공통 여부 */}
					{teacher?.department?.slug?.startsWith('beauty-') && (
						<label className="flex items-center gap-3 cursor-pointer">
							<div
								onClick={() => setSIsCommon(!sIsCommon)}
								className={`w-12 h-6 rounded-full transition-colors ${sIsCommon ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-700'}`}
							>
								<div
									className={`w-5 h-5 bg-white rounded-full shadow transition-transform m-0.5 ${sIsCommon ? 'translate-x-6' : ''}`}
								/>
							</div>
							<span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
								미용 공통 과목
							</span>
						</label>
					)}

					{/* 카테고리 */}
					<div>
						<label className="text-xs font-bold text-slate-500 mb-1.5 block">
							카테고리 (과목명)
						</label>
						<input
							className="input-field"
							placeholder="예: 헤어미용, 공중위생관리학"
							value={sCategory}
							onChange={(e) => setSCategory(e.target.value)}
						/>
					</div>

					{/* 문제 */}
					<div>
						<label className="text-xs font-bold text-slate-500 mb-1.5 block">
							문제
						</label>
						<textarea
							className="input-field resize-none"
							rows={3}
							placeholder="문제 내용을 입력하세요"
							value={sQuestion}
							onChange={(e) => setSQuestion(e.target.value)}
						/>
					</div>

					{/* 이미지 첨부 */}
					<div>
						<label className="text-xs font-bold text-slate-500 mb-1.5 block">
							이미지 첨부 (선택)
						</label>
						{sImagePreview ? (
							<div className="relative">
								<img
									src={sImagePreview}
									alt="미리보기"
									className="w-full rounded-2xl object-cover max-h-48"
								/>
								<button
									onClick={removeImage}
									className="absolute top-2 right-2 w-7 h-7 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg active:scale-90"
								>
									<X size={14} />
								</button>
							</div>
						) : (
							<div
								onClick={() => imgFileRef.current?.click()}
								className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-5 text-center cursor-pointer hover:border-brand-400 transition-colors"
							>
								<ImagePlus size={24} className="mx-auto text-slate-400 mb-2" />
								<p className="text-sm text-slate-400 font-semibold">
									이미지 선택
								</p>
								<p className="text-xs text-slate-300 mt-0.5">JPG, PNG 등</p>
								<input
									ref={imgFileRef}
									type="file"
									accept="image/*"
									onChange={handleImageSelect}
									className="hidden"
								/>
							</div>
						)}
					</div>

					{/* 선택지 4개 */}
					<div>
						<label className="text-xs font-bold text-slate-500 mb-1.5 block">
							선택지{' '}
							<span className="text-slate-400 font-normal">
								(정답 번호 클릭으로 선택)
							</span>
						</label>
						<div className="space-y-2">
							{sOptions.map((opt, i) => (
								<div key={i} className="flex items-center gap-2">
									<button
										onClick={() => setSAnswer(i)}
										className={`w-8 h-8 rounded-full text-sm font-black flex-none transition-all ${
											sAnswer === i
												? 'bg-emerald-500 text-white scale-110'
												: 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'
										}`}
									>
										{i + 1}
									</button>
									<input
										className="input-field py-2.5"
										placeholder={`${i + 1}번 선택지`}
										value={opt}
										onChange={(e) => {
											const next = [...sOptions];
											next[i] = e.target.value;
											setSOptions(next);
										}}
									/>
								</div>
							))}
						</div>
						{sAnswer !== null && (
							<p className="text-xs text-emerald-500 font-bold mt-2 px-1">
								✓ {sAnswer + 1}번이 정답으로 설정됨
							</p>
						)}
					</div>

					{/* 해설 */}
					<div>
						<label className="text-xs font-bold text-slate-500 mb-1.5 block">
							해설 (선택)
						</label>
						<textarea
							className="input-field resize-none"
							rows={2}
							placeholder="해설을 입력하세요 (없어도 됩니다)"
							value={sExplanation}
							onChange={(e) => setSExplanation(e.target.value)}
						/>
					</div>

					{sSaveResult && (
						<p
							className={`text-sm font-bold text-center py-3 rounded-2xl ${
								sSaveResult.startsWith('✅')
									? 'bg-emerald-50 text-emerald-600'
									: sSaveResult.startsWith('🔄')
										? 'bg-blue-50 text-blue-600'
										: 'bg-rose-50 text-rose-500'
							}`}
						>
							{sSaveResult}
						</p>
					)}

					<button
						onClick={handleSingleSave}
						disabled={sSaving}
						className="btn-primary disabled:opacity-40"
					>
						{sSaving ? '저장 중...' : '문제 등록'}
					</button>
				</div>
			)}

			{/* 내가 올린 문제 목록 */}
			<div className="card p-5">
				<h2 className="font-black text-slate-800 dark:text-white mb-4">
					내가 올린 문제 ({questions.length})
				</h2>
				{questions.length === 0 ? (
					<p className="text-center text-slate-400 py-6 text-sm">
						아직 올린 문제가 없습니다
					</p>
				) : (
					<div className="space-y-2 max-h-96 overflow-y-auto no-scrollbar">
						{questions.map((q) => (
							<div
								key={q.id}
								className={`p-3 rounded-xl border flex items-start gap-3 ${
									q.is_active
										? 'border-slate-100 dark:border-slate-700'
										: 'border-rose-100 dark:border-rose-900/30 opacity-50'
								}`}
							>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2 mb-0.5 flex-wrap">
										<span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-lg font-medium">
											{q.category}
										</span>
										<span className="text-xs text-slate-400">
											{EXAM_TYPE_LABELS[q.exam_type]}
										</span>
										{q.is_common && (
											<span className="text-xs text-brand-400">공통</span>
										)}
										{q.image_url && (
											<span className="text-xs text-amber-500">🖼 이미지</span>
										)}
									</div>
									<p className="text-sm text-slate-700 dark:text-slate-300 truncate font-medium">
										{q.question_text}
									</p>
								</div>
								<div className="flex gap-1 flex-none">
									<button
										onClick={() => toggleActive(q)}
										className="p-1.5 text-slate-400 hover:text-brand-500 transition-colors"
									>
										{q.is_active ? <Eye size={15} /> : <EyeOff size={15} />}
									</button>
									<button
										onClick={() => deleteQuestion(q.id)}
										className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
									>
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
