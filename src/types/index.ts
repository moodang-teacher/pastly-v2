// ============================================
// 전역 타입 정의
// ============================================

export type ExamType = 'past_exam' | 'mock' | 'crash';

export interface Department {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  specialty_count: number;
  common_count: number;
  is_active: boolean;
}

export interface Teacher {
  id: string;
  user_id: string;
  name: string;
  department_id: string;
  department?: Department;
}

export interface Cohort {
  id: string;
  name: string;
  department_id: string;
  teacher_id: string;
  is_active: boolean;
  archived_at: string | null;
  created_at: string;
  department?: Department;
}

export interface Student {
  id: string;
  user_id: string;
  name: string;
  department_id: string;
  cohort_id: string;
  total_attempts: number;
  high_score: number;
  photo_url: string | null;
  created_at: string;
  department?: Department;
  cohort?: Cohort;
}

export interface Question {
  id: string;
  department_id: string;
  is_common: boolean;
  exam_type: ExamType;
  category: string;
  question_text: string;
  options: string[];
  answer_index: number;
  explanation: string | null;
  image_url: string | null;
  uploaded_by: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Attempt {
  id: string;
  student_id: string;
  score: number;
  exam_type: ExamType;
  total_questions: number;
  correct_count: number;
  department_id: string;
  created_at: string;
}

export interface WrongAnswer {
  id: string;
  student_id: string;
  question_id: string;
  question?: Question;
}

// 퀴즈 진행 중 상태
export interface QuizSession {
  questions: Question[];
  currentIndex: number;
  correctCount: number;
  examType: ExamType;
  subjectStats: Record<string, { total: number; correct: number }>;
}

// 레벨 시스템
export interface LevelInfo {
  label: string;
  emoji: string;
  minAttempts: number;
}

export const LEVELS: LevelInfo[] = [
  { label: 'STONE',       emoji: '🗿', minAttempts: 0    },
  { label: 'IRON',        emoji: '⚙️', minAttempts: 30   },
  { label: 'BRONZE II',   emoji: '🥉', minAttempts: 60   },
  { label: 'BRONZE I',    emoji: '🥉', minAttempts: 120  },
  { label: 'SILVER II',   emoji: '🥈', minAttempts: 200  },
  { label: 'SILVER I',    emoji: '🥈', minAttempts: 300  },
  { label: 'GOLD II',     emoji: '🥇', minAttempts: 450  },
  { label: 'GOLD I',      emoji: '🥇', minAttempts: 600  },
  { label: 'PLATINUM II', emoji: '💠', minAttempts: 800  },
  { label: 'PLATINUM I',  emoji: '💠', minAttempts: 1000 },
  { label: 'DIAMOND',     emoji: '💎', minAttempts: 1300 },
  { label: 'EXPERT',      emoji: '✨', minAttempts: 1700 },
  { label: 'MASTER',      emoji: '🏆', minAttempts: 2200 },
  { label: 'GRANDMASTER', emoji: '👑', minAttempts: 2800 },
  { label: 'LEGEND',      emoji: '⚡', minAttempts: 3500 },
];

export function getLevelInfo(totalAttempts: number): LevelInfo {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalAttempts >= LEVELS[i].minAttempts) return LEVELS[i];
  }
  return LEVELS[0];
}

export function getLevelLabel(totalAttempts: number): string {
  const level = getLevelInfo(totalAttempts);
  return `${level.emoji} ${level.label}`;
}

// JSON 업로드 포맷 (선생님이 만드는 파일)
export interface UploadQuestion {
  category: string;
  question_text: string;
  options: [string, string, string, string];
  answer_index: number; // 0-based
  explanation?: string;
  image_url?: string;
}

export interface UploadPayload {
  questions: UploadQuestion[];
}
