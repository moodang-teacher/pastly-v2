'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getLevelLabel } from '@/types';
import type { Student, Department } from '@/types';
import {
	LogOut,
	Sun,
	Moon,
	Trophy,
	ChevronDown,
	Camera,
	LayoutDashboard,
} from 'lucide-react';
import Image from 'next/image';

interface RankEntry {
	name: string;
	photo_url: string | null;
	high_score: number;
	total_attempts: number;
}

const EXAM_TYPES = [
	{
		value: 'past_exam',
		label: '📚 기출문제 풀이',
		desc: '실제 기출문제 랜덤 60문항',
	},
	{ value: 'mock', label: '✏️ 모의고사', desc: '선생님이 구성한 모의고사' },
	{ value: 'crash', label: '⚡ Crash Test', desc: '전체 문제 랜덤 출제' },
];

// 이미지 압축 함수
async function compressImage(file: File): Promise<string> {
	return new Promise((resolve) => {
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d')!;
		const img = new window.Image();
		img.onload = () => {
			const max = 300;
			let { width, height } = img;
			if (width > height) {
				if (width > max) {
					height = (height * max) / width;
					width = max;
				}
			} else {
				if (height > max) {
					width = (width * max) / height;
					height = max;
				}
			}
			canvas.width = width;
			canvas.height = height;
			ctx.drawImage(img, 0, 0, width, height);
			resolve(canvas.toDataURL('image/jpeg', 0.82));
		};
		img.src = URL.createObjectURL(file);
	});
}

export default function HomePage() {
	const router = useRouter();
	const supabase = createClient();
	const avatarInputRef = useRef<HTMLInputElement>(null);

	const [student, setStudent] = useState<Student | null>(null);
	const [department, setDepartment] = useState<Department | null>(null);
	const [rankings, setRankings] = useState<RankEntry[]>([]);
	const [wrongCount, setWrongCount] = useState(0);
	const [isDark, setIsDark] = useState(false);
	const [selectedExam, setSelectedExam] = useState('past_exam');
	const [showExamDrop, setShowExamDrop] = useState(false);
	const [loading, setLoading] = useState(true);
	const [noDept, setNoDept] = useState(false);
	const [avatarUploading, setAvatarUploading] = useState(false);
	const [isTeacher, setIsTeacher] = useState(false);

	const loadData = useCallback(async () => {
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) {
			router.push('/login');
			return;
		}

		// 선생님 여부 확인
		const { data: teacher } = await supabase
			.from('teachers')
			.select('id')
			.eq('user_id', user.id)
			.single();
		setIsTeacher(!!teacher);

		const { data: st } = await supabase
			.from('students')
			.select('*, department:departments(*), cohort:cohorts(*)')
			.eq('user_id', user.id)
			.single();

		if (!st) {
			const { data: newSt } = await supabase
				.from('students')
				.insert({
					user_id: user.id,
					name: user.email?.split('@')[0] || '학생',
					total_attempts: 0,
					high_score: 0,
				})
				.select()
				.single();
			setStudent(newSt);
			setNoDept(true);
			setLoading(false);
			return;
		}

		setStudent(st);
		if (!st.department_id) {
			router.push('/select-dept');
			return;
		}
		setDepartment(st.department);

		const { count } = await supabase
			.from('wrong_answers')
			.select('*', { count: 'exact', head: true })
			.eq('student_id', st.id);
		setWrongCount(count || 0);

		const { data: rank } = await supabase.rpc('get_rankings', {
			p_department_id: st.department_id,
		});
		setRankings(rank || []);

		setLoading(false);
	}, []);

	useEffect(() => {
		setIsDark(document.documentElement.classList.contains('dark'));
		loadData();
	}, [loadData]);

	function toggleTheme() {
		const next = !isDark;
		setIsDark(next);
		document.documentElement.classList.toggle('dark', next);
		localStorage.setItem('theme', next ? 'dark' : 'light');
	}

	async function handleLogout() {
		await supabase.auth.signOut();
		router.push('/login');
	}

	function startQuiz(mode: string) {
		if (!department) return alert('선생님께 전공 배정을 요청해주세요.');
		router.push(`/quiz?type=${mode}&dept=${department.id}`);
	}

	// 아바타 업로드
	async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file || !student) return;

		if (file.size > 5 * 1024 * 1024) {
			alert('5MB 이하 이미지를 선택해주세요.');
			return;
		}

		setAvatarUploading(true);
		try {
			const base64 = await compressImage(file);
			await supabase
				.from('students')
				.update({ photo_url: base64 })
				.eq('id', student.id);
			setStudent((prev) => (prev ? { ...prev, photo_url: base64 } : prev));
		} catch {
			alert('아바타 변경 중 오류가 발생했습니다.');
		} finally {
			setAvatarUploading(false);
			if (avatarInputRef.current) avatarInputRef.current.value = '';
		}
	}

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
			</div>
		);
	}

	return (
		<div className="max-w-md mx-auto min-h-screen flex flex-col p-5 pb-8">
			{/* 헤더 */}
			<header className="flex justify-between items-center mb-6">
				<img
					src="https://moodang-teacher.github.io/pastly/images/pastly_logo.png"
					alt="Pastly"
					className="h-7 w-auto object-contain"
				/>
				<div className="flex gap-2">
					{/* 선생님일 때만 관리자 버튼 표시 */}
					{isTeacher && (
						<button
							onClick={() => router.push('/admin')}
							className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 text-xs font-bold transition-all active:scale-90"
						>
							<LayoutDashboard size={15} />
							관리자
						</button>
					)}
					<button
						onClick={toggleTheme}
						className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 transition-all active:scale-90"
					>
						{isDark ? <Sun size={18} /> : <Moon size={18} />}
					</button>
					<button
						onClick={handleLogout}
						className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-rose-500 transition-all active:scale-90"
					>
						<LogOut size={18} />
					</button>
				</div>
			</header>

			{/* 프로필 카드 */}
			<div className="card p-5 flex items-center gap-4 mb-5">
				{/* 아바타 (클릭하면 교체) */}
				<div className="relative flex-none">
					<button
						onClick={() => avatarInputRef.current?.click()}
						disabled={avatarUploading}
						className="w-14 h-14 rounded-2xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-2xl overflow-hidden relative group"
					>
						{student?.photo_url ? (
							<img
								src={student.photo_url}
								className="w-full h-full object-cover"
								alt="아바타"
							/>
						) : (
							<span>👤</span>
						)}
						{/* 호버 오버레이 */}
						<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
							{avatarUploading ? (
								<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
							) : (
								<Camera size={16} className="text-white" />
							)}
						</div>
					</button>
					<input
						ref={avatarInputRef}
						type="file"
						accept="image/*"
						onChange={handleAvatarChange}
						className="hidden"
					/>
				</div>

				<div className="flex-1 min-w-0">
					<p className="font-black text-lg truncate dark:text-white">
						{student?.name}
					</p>
					<p className="text-xs text-brand-500 font-bold">
						{getLevelLabel(student?.total_attempts || 0)}
					</p>
					{department && (
						<p className="text-xs text-slate-400 font-medium mt-0.5">
							{department.name}
						</p>
					)}
				</div>
				{noDept && (
					<span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2.5 py-1.5 rounded-xl font-bold">
						전공 배정 대기중
					</span>
				)}
			</div>

			{/* 시험 유형 선택 드롭다운 */}
			<div className="relative mb-4">
				<button
					onClick={() => setShowExamDrop(!showExamDrop)}
					className="card w-full p-4 flex items-center justify-between gap-3 active:scale-[0.98] transition-all"
				>
					<span className="font-black text-base dark:text-white">
						{EXAM_TYPES.find((e) => e.value === selectedExam)?.label}
					</span>
					<ChevronDown
						size={18}
						className={`text-slate-400 transition-transform ${showExamDrop ? 'rotate-180' : ''}`}
					/>
				</button>
				{showExamDrop && (
					<div className="absolute top-full left-0 right-0 mt-2 card shadow-xl z-20 overflow-hidden animate-pop">
						{EXAM_TYPES.map((et) => (
							<button
								key={et.value}
								onClick={() => {
									setSelectedExam(et.value);
									setShowExamDrop(false);
								}}
								className={`w-full p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b last:border-0 border-slate-100 dark:border-slate-700 ${
									selectedExam === et.value
										? 'bg-brand-50 dark:bg-brand-900/20'
										: ''
								}`}
							>
								<p className="font-bold text-sm dark:text-white">{et.label}</p>
								<p className="text-xs text-slate-400 mt-0.5">{et.desc}</p>
							</button>
						))}
					</div>
				)}
			</div>

			{/* 메인 버튼 2개 */}
			<div className="grid grid-cols-2 gap-3 mb-5">
				<button
					onClick={() => startQuiz(selectedExam)}
					className="aspect-square p-5 bg-brand-50 dark:bg-brand-900/20 rounded-3xl border-2 border-brand-100 dark:border-brand-800 flex flex-col items-center justify-center text-center transition-all active:scale-95"
				>
					<div className="w-14 h-14 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center text-3xl mb-3 shadow-sm">
						📚
					</div>
					<span className="text-brand-800 dark:text-brand-300 font-black text-sm tracking-tight">
						{EXAM_TYPES.find((e) => e.value === selectedExam)
							?.label.split(' ')
							.slice(1)
							.join(' ')}
					</span>
				</button>

				<button
					onClick={() => router.push('/quiz?type=wrong')}
					className="aspect-square p-5 bg-rose-50 dark:bg-rose-900/20 rounded-3xl border-2 border-rose-100 dark:border-rose-800 flex flex-col items-center justify-center text-center transition-all active:scale-95 relative"
					disabled={wrongCount === 0}
					style={{ opacity: wrongCount === 0 ? 0.6 : 1 }}
				>
					<div className="w-14 h-14 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center text-3xl mb-3 shadow-sm">
						💣
					</div>
					<span className="text-rose-800 dark:text-rose-300 font-black text-sm tracking-tight">
						오답 복습
					</span>
					{wrongCount > 0 && (
						<span className="absolute top-4 right-4 bg-rose-500 text-white text-xs font-black px-2 py-0.5 rounded-full">
							{wrongCount}
						</span>
					)}
				</button>
			</div>

			{/* 명예의 전당 */}
			<div className="flex-1">
				<div className="flex items-center gap-2 mb-4">
					<Trophy size={18} className="text-amber-400" />
					<h3 className="font-black text-slate-800 dark:text-slate-100 tracking-tighter">
						명예의 전당
					</h3>
					{department && (
						<span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-lg font-bold">
							{department.name}
						</span>
					)}
				</div>

				{noDept ? (
					<div className="card p-8 text-center text-slate-400">
						<p className="text-3xl mb-3">⏳</p>
						<p className="font-semibold text-sm">
							전공 배정 후 랭킹을 볼 수 있어요
						</p>
					</div>
				) : rankings.length === 0 ? (
					<div className="card p-8 text-center text-slate-400">
						<p className="font-semibold text-sm">
							아직 기록이 없어요. 첫 번째 도전자가 되세요!
						</p>
					</div>
				) : (
					<div className="space-y-3">
						{rankings.map((r, i) => (
							<div
								key={i}
								className="card p-4 flex items-center justify-between"
							>
								<div className="flex items-center gap-3">
									<span className="text-xl">
										{['🥇', '🥈', '🥉'][i] || '🏅'}
									</span>
									<div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-base overflow-hidden">
										{r.photo_url ? (
											<img
												src={r.photo_url}
												className="w-full h-full object-cover"
												alt=""
											/>
										) : (
											'👤'
										)}
									</div>
									<div>
										<p className="font-bold text-sm dark:text-white">
											{r.name}
										</p>
										<p className="text-xs text-brand-400 font-medium">
											{getLevelLabel(r.total_attempts || 0)}
										</p>
									</div>
								</div>
								<span className="font-black text-brand-600 dark:text-brand-400">
									{r.high_score}점
								</span>
							</div>
						))}
					</div>
				)}
			</div>

			<footer className="text-center pt-6 text-xs text-slate-400 font-medium tracking-widest">
				&copy; 巫堂先生
			</footer>
		</div>
	);
}
