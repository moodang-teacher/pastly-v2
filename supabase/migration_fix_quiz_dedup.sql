-- ============================================
-- 중복 문제 방지 마이그레이션
-- Supabase 대시보드 > SQL Editor 에서 실행
-- question_text 기준으로 중복된 문제가 있어도
-- 시험에서 같은 문제가 두 번 나오지 않도록 수정
-- ============================================

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
