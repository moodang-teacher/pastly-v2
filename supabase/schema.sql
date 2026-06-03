-- ============================================
-- PASTLY v2 - Supabase Schema
-- ============================================

-- 전공 테이블
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  parent_id UUID REFERENCES departments(id),
  specialty_count INTEGER NOT NULL DEFAULT 60, -- 전공 문제 수
  common_count INTEGER NOT NULL DEFAULT 0,     -- 공통 문제 수
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 기본 전공 데이터
INSERT INTO departments (name, slug, parent_id, specialty_count, common_count) VALUES
  ('제품디자인', 'product-design', NULL, 60, 0),
  ('미용', 'beauty', NULL, 0, 0),
  ('미용-헤어', 'beauty-hair', (SELECT id FROM departments WHERE slug='beauty'), 36, 24),
  ('미용-네일', 'beauty-nail', (SELECT id FROM departments WHERE slug='beauty'), 36, 24),
  ('미용-피부', 'beauty-skin', (SELECT id FROM departments WHERE slug='beauty'), 39, 21),
  ('미용-메이크업', 'beauty-makeup', (SELECT id FROM departments WHERE slug='beauty'), 37, 23);

-- 선생님 프로필 (auth.users 와 연결)
CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  name TEXT NOT NULL,
  department_id UUID REFERENCES departments(id),
  is_master BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 기수 (학년/학기 구분)
CREATE TABLE cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,             -- 예: "2025년 1기"
  department_id UUID REFERENCES departments(id),
  teacher_id UUID REFERENCES teachers(id),
  is_active BOOLEAN DEFAULT true, -- 현재 활성 기수
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 학생 프로필
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  name TEXT NOT NULL,
  department_id UUID REFERENCES departments(id),
  cohort_id UUID REFERENCES cohorts(id),
  total_attempts INTEGER DEFAULT 0,  -- 레벨용 누적 풀이 수 (맞든 틀리든)
  high_score INTEGER DEFAULT 0,      -- 랭킹용 최고점
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 문제 풀
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID REFERENCES departments(id), -- 어느 전공/공통
  is_common BOOLEAN DEFAULT false,               -- true = 미용 공통, false = 전공 전용
  exam_type TEXT NOT NULL CHECK (exam_type IN ('past_exam', 'mock', 'crash')),
  category TEXT NOT NULL,            -- 과목명 (공중위생관리학, 헤어미용 등)
  question_text TEXT NOT NULL,
  options JSONB NOT NULL,            -- ["선택1", "선택2", "선택3", "선택4"]
  answer_index INTEGER NOT NULL,     -- 0-based
  explanation TEXT,
  image_url TEXT,
  uploaded_by UUID REFERENCES teachers(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 풀이 기록 (레벨 계산용)
CREATE TABLE attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,            -- 이번 시험 점수
  exam_type TEXT NOT NULL,
  total_questions INTEGER NOT NULL,
  correct_count INTEGER NOT NULL,
  department_id UUID REFERENCES departments(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 오답 기록
CREATE TABLE wrong_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, question_id)
);

-- ============================================
-- RLS (Row Level Security) 설정
-- ============================================

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wrong_answers ENABLE ROW LEVEL SECURITY;

-- departments: 모두 읽기 가능
CREATE POLICY "departments_public_read" ON departments FOR SELECT USING (true);

-- teachers: 자기 정보만
CREATE POLICY "teachers_self" ON teachers FOR ALL USING (user_id = auth.uid());
CREATE POLICY "teachers_public_read" ON teachers FOR SELECT USING (true);

-- cohorts: 선생님은 자기 반, 마스터는 전체 읽기
CREATE POLICY "cohorts_teacher_manage" ON cohorts FOR ALL
  USING (teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid()));
CREATE POLICY "cohorts_public_read" ON cohorts FOR SELECT USING (true);

-- students: 자기 정보 + 같은 전공 선생님 + 마스터 전체 읽기
CREATE POLICY "students_self" ON students FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "students_teacher_manage" ON students FOR ALL
  USING (
    department_id IN (
      SELECT department_id FROM teachers WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "students_insert_self" ON students FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "students_update_self" ON students FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "students_master_read" ON students FOR SELECT
  USING (EXISTS (SELECT 1 FROM teachers WHERE user_id = auth.uid() AND is_master = true));

-- questions: 모두 읽기, 선생님만 쓰기
CREATE POLICY "questions_public_read" ON questions FOR SELECT USING (is_active = true);
CREATE POLICY "questions_teacher_insert" ON questions FOR INSERT
  WITH CHECK (uploaded_by IN (SELECT id FROM teachers WHERE user_id = auth.uid()));
CREATE POLICY "questions_teacher_update" ON questions FOR UPDATE
  USING (uploaded_by IN (SELECT id FROM teachers WHERE user_id = auth.uid()));

-- attempts: 자기 기록만 + 마스터 전체 읽기
CREATE POLICY "attempts_self" ON attempts FOR ALL USING (
  student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
);
CREATE POLICY "attempts_master_read" ON attempts FOR SELECT
  USING (EXISTS (SELECT 1 FROM teachers WHERE user_id = auth.uid() AND is_master = true));

-- wrong_answers: 자기 오답만
CREATE POLICY "wrong_answers_self" ON wrong_answers FOR ALL USING (
  student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
);

-- ============================================
-- 유용한 함수들
-- ============================================

-- 랭킹 조회 함수 (전공별 TOP 10)
CREATE OR REPLACE FUNCTION get_rankings(p_department_id UUID)
RETURNS TABLE (
  student_id UUID,
  name TEXT,
  photo_url TEXT,
  high_score INTEGER,
  total_attempts INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.name, s.photo_url, s.high_score, s.total_attempts
  FROM students s
  WHERE s.department_id = p_department_id
    AND s.cohort_id IN (
      SELECT id FROM cohorts WHERE department_id = p_department_id AND is_active = true
    )
  ORDER BY s.high_score DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 문제 뽑기 함수 (question_text 기준 중복 제거 후 추출)
CREATE OR REPLACE FUNCTION get_quiz_questions(
  p_department_id UUID,
  p_exam_type TEXT
)
RETURNS TABLE (question JSONB) AS $$
DECLARE
  v_dept departments%ROWTYPE;
  v_parent_id UUID;
  v_specialty_count INTEGER;
  v_common_count INTEGER;
  v_is_beauty BOOLEAN;
BEGIN
  SELECT * INTO v_dept FROM departments WHERE id = p_department_id;
  v_specialty_count := v_dept.specialty_count;
  v_common_count    := v_dept.common_count;
  v_parent_id       := v_dept.parent_id;
  v_is_beauty       := (v_parent_id IS NOT NULL AND v_common_count > 0);

  IF v_is_beauty THEN
    -- 미용: 전공 풀 + 공통 풀에서 비율에 맞게 추출 (각 풀에서 중복 제거)
    -- crash 타입은 모든 exam_type 포함
    RETURN QUERY
    WITH specialty_pool AS (
      SELECT * FROM (
        SELECT DISTINCT ON (q.question_text) q.*
        FROM questions q
        WHERE q.department_id = p_department_id
          AND q.is_common = false
          AND (p_exam_type = 'crash' OR q.exam_type = p_exam_type)
          AND q.is_active = true
        ORDER BY q.question_text, random()
      ) deduped
      ORDER BY random()
      LIMIT v_specialty_count
    ),
    common_pool AS (
      SELECT * FROM (
        SELECT DISTINCT ON (q.question_text) q.*
        FROM questions q
        WHERE q.department_id = v_parent_id
          AND q.is_common = true
          AND (p_exam_type = 'crash' OR q.exam_type = p_exam_type)
          AND q.is_active = true
        ORDER BY q.question_text, random()
      ) deduped
      ORDER BY random()
      LIMIT v_common_count
    )
    SELECT row_to_json(q.*)::JSONB FROM (
      SELECT * FROM specialty_pool
      UNION ALL
      SELECT * FROM common_pool
      ORDER BY random()
    ) q;
  ELSE
    -- 제품디자인: 단일 풀에서 60문제 (중복 제거)
    -- crash 타입은 모든 exam_type 포함
    RETURN QUERY
    SELECT row_to_json(q.*)::JSONB FROM (
      SELECT * FROM (
        SELECT DISTINCT ON (question_text) *
        FROM questions
        WHERE department_id = p_department_id
          AND (p_exam_type = 'crash' OR exam_type = p_exam_type)
          AND is_active = true
        ORDER BY question_text, random()
      ) deduped
      ORDER BY random()
      LIMIT 60
    ) q;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Storage 버킷 설정 (Supabase 대시보드에서 실행)
-- ============================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('question-images', 'question-images', true);
-- CREATE POLICY "Public read images" ON storage.objects FOR SELECT USING (bucket_id = 'question-images');
-- CREATE POLICY "Teachers upload images" ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'question-images' AND auth.uid() IN (
--     SELECT user_id FROM teachers
--   ));
