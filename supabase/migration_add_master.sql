-- ============================================
-- 마스터 계정 추가 마이그레이션
-- Supabase 대시보드 > SQL Editor 에서 실행
-- ============================================

-- 1. teachers 테이블에 is_master 컬럼 추가
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS is_master BOOLEAN DEFAULT false;

-- 2. 마스터용 RLS 정책 추가

-- 학생 전체 읽기
CREATE POLICY "students_master_read" ON students FOR SELECT
  USING (EXISTS (SELECT 1 FROM teachers WHERE user_id = auth.uid() AND is_master = true));

-- 시험 기록 전체 읽기
CREATE POLICY "attempts_master_read" ON attempts FOR SELECT
  USING (EXISTS (SELECT 1 FROM teachers WHERE user_id = auth.uid() AND is_master = true));

-- ============================================
-- 3. 마스터 계정 지정 (계정 생성 후 아래 실행)
-- user_id 는 Supabase > Authentication > Users 에서 확인
-- ============================================
-- UPDATE teachers SET is_master = true WHERE user_id = '여기에-user-id-입력';

-- ============================================
-- 4. 마스터 계정의 학생 레코드 삭제
-- (회원가입 폼으로 가입 시 생긴 student 레코드 제거)
-- ============================================
DELETE FROM students
  WHERE user_id IN (SELECT user_id FROM teachers WHERE is_master = true);
