'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Question, Student } from '@/types';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';

// ── 슬롯머신 숫자 컴포넌트 ──────────────────────────────────
function SlotDigit({ digit, delay }: { digit: string; delay: number }) {
	const nums = '0123456789';
	const target = parseInt(digit, 10);
	// 0부터 target까지 배열 생성
	const sequence = [];
	for (let i = 0; i <= 9; i++) sequence.push(i.toString());

	return (
		<span
			className="slot-reel"
			style={
				{
					'--slot-distance': `${target}em`,
					'--slot-delay': `${delay}ms`,
				} as React.CSSProperties
			}
		>
			<span className="slot-digits">
				{sequence.map((n, i) => (
					<span key={i}>{n}</span>
				))}
			</span>
		</span>
	);
}

// ── 애니메이션 점수 표시 ───────────────────────────────────
function AnimatedScore({ score }: { score: number }) {
	const [show, setShow] = useState(false);
	useEffect(() => {
		const t = setTimeout(() => setShow(true), 100);
		return () => clearTimeout(t);
	}, []);

	const digits = score.toString().split('');

	if (!show)
		return (
			<span className="text-7xl font-black text-brand-600 dark:text-brand-400">
				0
			</span>
		);

	return (
		<div className="text-7xl font-black text-brand-600 dark:text-brand-400 leading-none">
			{digits.map((d, i) => (
				<SlotDigit key={i} digit={d} delay={i * 120} />
			))}
		</div>
	);
}

// ── 애니메이션 프로그레스바 ───────────────────────────────
function AnimatedBar({ pct, delay }: { pct: number; delay: number }) {
	const [started, setStarted] = useState(false);
	useEffect(() => {
		const t = setTimeout(() => setStarted(true), delay + 300);
		return () => clearTimeout(t);
	}, [delay]);

	return (
		<div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden shadow-inner">
			<div
				className="h-full bg-brand-500 rounded-full"
				style={{
					width: started ? `${pct}%` : '0%',
					transition: started
						? 'width 0.9s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
						: 'none',
				}}
			/>
		</div>
	);
}

// ── 결과 화면 ──────────────────────────────────────────────
function ResultScreen({
	score,
	questions,
	answers,
	onHome,
}: {
	score: number;
	questions: Question[];
	answers: number[];
	onHome: () => void;
}) {
	const pass = score >= 60;
	const [reviewOpen, setReviewOpen] = useState(false);
	const [openItems, setOpenItems] = useState<Set<number>>(new Set());

	const toggleItem = (idx: number) => {
		setOpenItems((prev: Set<number>) => {
			const next = new Set(prev);
			if (next.has(idx)) next.delete(idx);
			else next.add(idx);
			return next;
		});
	};

	const subStats: Record<string, { total: number; correct: number }> = {};
	questions.forEach((q, i) => {
		if (!subStats[q.category]) subStats[q.category] = { total: 0, correct: 0 };
		subStats[q.category].total++;
		if (answers[i] === q.answer_index) subStats[q.category].correct++;
	});

	const entries = Object.entries(subStats);

	return (
		<div className="min-h-screen flex flex-col items-center py-12 px-6 animate-fade-in">
			{/* 트로피 */}
			<div
				className={`w-24 h-24 rounded-[2.5rem] flex items-center justify-center text-5xl mb-6 shadow-inner ${
					pass
						? 'bg-brand-50 dark:bg-brand-900/30'
						: 'bg-rose-50 dark:bg-rose-900/30'
				}`}
			>
				{pass ? '🏆' : '📖'}
			</div>

			<h2
				className={`text-2xl font-black mb-6 ${pass ? 'text-brand-600' : 'text-rose-500'}`}
			>
				{pass ? '합격입니다!' : '불합격입니다.'}
			</h2>

			{/* 슬롯머신 점수 */}
			<div className="mb-1 flex items-end gap-2">
				<AnimatedScore score={score} />
				<span className="text-4xl font-black text-brand-600 dark:text-brand-400 mb-1">
					점
				</span>
			</div>
			<p className="text-slate-400 text-sm font-semibold mb-10">/ 100점</p>

			{/* 카테고리별 프로그레스바 */}
			<div className="w-full max-w-xs space-y-5 mb-10">
				{entries.map(([cat, stat], idx) => {
					const pct = Math.round((stat.correct / stat.total) * 100);
					return (
						<div key={cat}>
							<div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
								<span>{cat}</span>
								<span className="text-brand-500">
									{pct}% ({stat.correct}/{stat.total})
								</span>
							</div>
							<AnimatedBar pct={pct} delay={idx * 150} />
						</div>
					);
				})}
			</div>

			{/* 답안 확인 접기/펼치기 */}
			<div className="w-full max-w-xs mb-6">
				<button
					onClick={() => setReviewOpen((v: boolean) => !v)}
					className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm"
				>
					<span>답안 확인 ({questions.length}문제)</span>
					{reviewOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
				</button>

				{reviewOpen && (
					<div className="mt-2 space-y-2">
						{questions.map((q, i) => {
							const isCorrect = answers[i] === q.answer_index;
							const isOpen = openItems.has(i);
							const myAnswer = answers[i];

							return (
								<div
									key={i}
									className={`rounded-2xl border-2 overflow-hidden ${
										isCorrect
											? 'border-emerald-200 dark:border-emerald-800'
											: 'border-rose-200 dark:border-rose-800'
									}`}
								>
									<button
										onClick={() => toggleItem(i)}
										className="w-full flex items-center gap-3 px-4 py-3 text-left"
									>
										<span
											className={`flex-none w-7 h-7 rounded-full text-xs font-black flex items-center justify-center ${
												isCorrect
													? 'bg-emerald-500 text-white'
													: 'bg-rose-500 text-white'
											}`}
										>
											{i + 1}
										</span>
										<span className="flex-1 text-xs font-semibold text-slate-700 dark:text-slate-300 line-clamp-1">
											{q.question_text}
										</span>
										{isOpen ? (
											<ChevronUp size={14} className="flex-none text-slate-400" />
										) : (
											<ChevronDown size={14} className="flex-none text-slate-400" />
										)}
									</button>

									{isOpen && (
										<div className="px-4 pb-4 pt-1 space-y-2 border-t border-slate-100 dark:border-slate-700">
											<p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pt-2">
												{q.question_text}
											</p>
											<div
												className={`flex items-start gap-2 px-3 py-2 rounded-xl text-xs ${
													isCorrect
														? 'bg-emerald-50 dark:bg-emerald-900/30'
														: 'bg-rose-50 dark:bg-rose-900/30'
												}`}
											>
												<span className="font-bold text-slate-500 shrink-0">
													내 답
												</span>
												<span
													className={`font-bold ${isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
												>
													{myAnswer === -1
														? '미응답'
														: `${myAnswer + 1}번. ${q.options[myAnswer]}`}
												</span>
											</div>
											{!isCorrect && (
												<div className="flex items-start gap-2 px-3 py-2 rounded-xl text-xs bg-emerald-50 dark:bg-emerald-900/30">
													<span className="font-bold text-slate-500 shrink-0">
														정답
													</span>
													<span className="font-bold text-emerald-600 dark:text-emerald-400">
														{q.answer_index + 1}번. {q.options[q.answer_index]}
													</span>
												</div>
											)}
											{q.explanation && (
												<p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed px-1">
													{q.explanation}
												</p>
											)}
										</div>
									)}
								</div>
							);
						})}
					</div>
				)}
			</div>

			<button onClick={onHome} className="btn-primary max-w-xs w-full">
				홈으로
			</button>
		</div>
	);
}

// ── 퀴즈 본체 ──────────────────────────────────────────────
function QuizContent() {
	const router = useRouter();
	const params = useSearchParams();
	const supabase = createClient();

	const examType = params.get('type') || 'past_exam';
	const deptId = params.get('dept') || '';

	const [student, setStudent] = useState<Student | null>(null);
	const [questions, setQuestions] = useState<Question[]>([]);
	const [currentIdx, setCurrentIdx] = useState(0);
	const [answers, setAnswers] = useState<number[]>([]);
	const [selected, setSelected] = useState<number | null>(null);
	const [answered, setAnswered] = useState(false);
	const [timeLeft, setTimeLeft] = useState(60);
	const [phase, setPhase] = useState<'loading' | 'quiz' | 'result'>('loading');
	const [feedbackOpen, setFeedbackOpen] = useState(false);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const q = questions[currentIdx];
	const score =
		questions.length > 0
			? Math.round(
					(answers.filter((a, i) => a === questions[i]?.answer_index).length /
						questions.length) *
						100,
				)
			: 0;

	useEffect(() => {
		async function load() {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) {
				router.push('/login');
				return;
			}

			const { data: st } = await supabase
				.from('students')
				.select('*')
				.eq('user_id', user.id)
				.single();
			setStudent(st);

			let qs: Question[] = [];

			if (examType === 'wrong') {
				const { data: wa } = await supabase
					.from('wrong_answers')
					.select('question:questions(*)')
					.eq('student_id', st?.id);
				qs = (wa || []).map((w: any) => w.question).filter(Boolean);
			} else {
				const { data } = await supabase.rpc('get_quiz_questions', {
					p_department_id: deptId,
					p_exam_type: examType,
				});
				qs = (data || []) as Question[];
			}

			if (qs.length === 0) {
				alert('문제가 없습니다. 선생님께 문의해주세요.');
				router.push('/home');
				return;
			}

			for (let i = qs.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[qs[i], qs[j]] = [qs[j], qs[i]];
			}

			setQuestions(qs);
			setAnswers(new Array(qs.length).fill(-1));
			setPhase('quiz');
		}
		load();
	}, []);

	useEffect(() => {
		if (phase !== 'quiz' || answered) return;
		setTimeLeft(60);
		timerRef.current = setInterval(() => {
			setTimeLeft((t) => {
				if (t <= 1) {
					clearInterval(timerRef.current!);
					handleAnswer(-1);
					return 0;
				}
				return t - 1;
			});
		}, 1000);
		return () => clearInterval(timerRef.current!);
	}, [currentIdx, phase]);

	async function handleAnswer(idx: number) {
		if (answered || !q) return;
		clearInterval(timerRef.current!);
		setSelected(idx);
		setAnswered(true);
		setFeedbackOpen(true);

		const newAnswers = [...answers];
		newAnswers[currentIdx] = idx;
		setAnswers(newAnswers);

		if (!student) return;
		const isCorrect = idx === q.answer_index;

		if (isCorrect) {
			await supabase
				.from('wrong_answers')
				.delete()
				.eq('student_id', student.id)
				.eq('question_id', q.id);
		} else {
			await supabase
				.from('wrong_answers')
				.upsert(
					{ student_id: student.id, question_id: q.id },
					{ onConflict: 'student_id,question_id' },
				);
		}
	}

	async function handleNext() {
		setFeedbackOpen(false);
		setAnswered(false);
		setSelected(null);

		if (currentIdx + 1 >= questions.length) {
			if (student && examType !== 'wrong') {
				const correctCount = answers.filter(
					(a, i) => a === questions[i]?.answer_index,
				).length;
				const finalScore = Math.round((correctCount / questions.length) * 100);

				await supabase.from('attempts').insert({
					student_id: student.id,
					score: finalScore,
					exam_type: examType,
					total_questions: questions.length,
					correct_count: correctCount,
					department_id: student.department_id,
				});

				const newAttempts = (student.total_attempts || 0) + questions.length;
				const newHigh = Math.max(student.high_score || 0, finalScore);
				await supabase
					.from('students')
					.update({
						total_attempts: newAttempts,
						high_score: newHigh,
					})
					.eq('id', student.id);
			}
			setPhase('result');
		} else {
			setCurrentIdx((i) => i + 1);
		}
	}

	if (phase === 'loading') {
		return (
			<div className="min-h-screen flex flex-col items-center justify-center gap-4">
				<div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
				<p className="text-slate-400 font-semibold text-sm">
					문제를 불러오는 중...
				</p>
			</div>
		);
	}

	if (phase === 'result') {
		return (
			<ResultScreen
				score={score}
				questions={questions}
				answers={answers}
				onHome={() => router.push('/home')}
			/>
		);
	}

	if (!q) return null;

	const isCorrect = selected === q.answer_index;
	const progress = (currentIdx / questions.length) * 100;
	const timerBlink = timeLeft <= 10 ? 'animate-pulse' : '';

	return (
		<div className="max-w-md mx-auto min-h-screen flex flex-col p-5">
			{/* 상단 바 */}
			<div className="flex items-center justify-between mb-6">
				<button
					onClick={() => router.push('/home')}
					className="p-2 text-slate-400 active:scale-90 transition-all"
				>
					<ArrowLeft size={22} />
				</button>
				<span className="px-3 py-1 bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 text-xs font-black rounded-xl">
					{q.category}
				</span>
				<span className={`text-2xl font-black text-rose-500 ${timerBlink}`}>
					{timeLeft}
				</span>
			</div>

			{/* 진행 바 */}
			<div className="mb-8">
				<div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
					<div
						className="h-full bg-brand-500 transition-all duration-300"
						style={{ width: `${progress}%` }}
					/>
				</div>
				<div className="flex justify-between text-xs font-black text-slate-400 mt-2 tracking-widest">
					<span>PROGRESS</span>
					<span>
						<span className="text-brand-500">{currentIdx + 1}</span> /{' '}
						{questions.length}
					</span>
				</div>
			</div>

			{/* 문제 영역 */}
			<div className="flex-1 overflow-y-auto no-scrollbar pb-4">
				<h2 className="text-lg font-bold text-slate-800 dark:text-white leading-relaxed mb-6">
					{q.question_text}
				</h2>

				{q.image_url && (
					<figure className="mb-6 rounded-2xl overflow-hidden border-4 border-slate-100 dark:border-slate-800 shadow-md">
						<img
							src={q.image_url}
							alt="문제 이미지"
							className="w-full h-auto"
						/>
					</figure>
				)}

				<div className="space-y-3">
					{q.options.map((opt, i) => {
						let cls =
							'w-full text-left p-5 rounded-2xl border-2 transition-all flex items-center gap-4 ';
						let badgeCls =
							'flex-none w-8 h-8 rounded-full text-sm font-black flex items-center justify-center ';

						if (!answered) {
							cls +=
								'border-slate-100 dark:border-slate-800 active:bg-slate-50 dark:active:bg-slate-900 shadow-sm';
							badgeCls += 'bg-slate-100 dark:bg-slate-800 text-slate-500';
						} else if (i === q.answer_index) {
							cls += 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30';
							badgeCls += 'bg-emerald-500 text-white';
						} else if (i === selected && !isCorrect) {
							cls += 'border-rose-400 bg-rose-50 dark:bg-rose-900/30';
							badgeCls += 'bg-rose-500 text-white';
						} else {
							cls += 'border-slate-100 dark:border-slate-800 opacity-40';
							badgeCls += 'bg-slate-100 dark:bg-slate-800 text-slate-500';
						}

						return (
							<button
								key={i}
								onClick={() => !answered && handleAnswer(i)}
								disabled={answered}
								className={cls}
							>
								<span className={badgeCls}>{i + 1}</span>
								<span className="dark:text-slate-200 font-semibold text-sm leading-snug">
									{opt}
								</span>
							</button>
						);
					})}
				</div>
			</div>

			{/* 피드백 패널 */}
			{feedbackOpen && (
				<div className="fixed inset-x-0 bottom-0 z-50 animate-slide-up">
					<div className="max-w-md mx-auto px-4 pb-4">
						<div
							className={`rounded-3xl p-6 shadow-2xl space-y-4 ${isCorrect ? 'bg-emerald-600' : 'bg-rose-600'}`}
						>
							<p className="text-base font-black text-yellow-300">
								{isCorrect
									? '정답입니다! ✅'
									: `오답! 정답은 ${q.answer_index + 1}번입니다. ❌`}
							</p>
							{q.explanation && (
								<p className="text-sm text-white/90 leading-relaxed">
									{q.explanation}
								</p>
							)}
							<button
								onClick={handleNext}
								className={`w-full py-4 bg-white font-black rounded-2xl text-base shadow-md ${
									isCorrect ? 'text-emerald-600' : 'text-rose-600'
								}`}
							>
								{currentIdx + 1 >= questions.length ? '결과 보기' : '다음 문제'}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

export default function QuizPage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen flex items-center justify-center">
					<div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
				</div>
			}
		>
			<QuizContent />
		</Suspense>
	);
}
