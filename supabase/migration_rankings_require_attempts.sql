-- ============================================
-- 명예의 전당: 문제를 풀지 않은 학생 제외
-- Supabase 대시보드 > SQL Editor 에서 실행
-- total_attempts > 0 인 학생만 랭킹에 표시
-- ============================================

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
    AND s.total_attempts > 0
    AND (
      s.cohort_id IS NULL
      OR s.cohort_id IN (
        SELECT id FROM cohorts WHERE department_id = p_department_id AND is_active = true
      )
    )
  ORDER BY s.high_score DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
