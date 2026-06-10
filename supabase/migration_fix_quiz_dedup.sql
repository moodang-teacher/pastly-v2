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
  v_sp_limit INTEGER;
  v_co_limit INTEGER;
  v_exam_filter TEXT;
BEGIN
  SELECT * INTO v_dept FROM departments WHERE id = p_department_id;
  v_specialty_count := v_dept.specialty_count;
  v_common_count    := v_dept.common_count;
  v_parent_id       := v_dept.parent_id;
  v_is_beauty       := (v_parent_id IS NOT NULL AND v_common_count > 0);

  -- crash: 기출문제 pool에서 과목 비율 유지하며 20문제
  IF p_exam_type = 'crash' THEN
    v_exam_filter := 'past_exam';
    IF v_is_beauty THEN
      v_sp_limit := ROUND(20.0 * v_specialty_count / (v_specialty_count + v_common_count))::INTEGER;
      v_co_limit := 20 - v_sp_limit;
    ELSE
      v_sp_limit := 20;
      v_co_limit := 0;
    END IF;
  ELSE
    v_exam_filter := p_exam_type;
    v_sp_limit    := v_specialty_count;
    v_co_limit    := v_common_count;
  END IF;

  IF v_is_beauty THEN
    RETURN QUERY
    WITH specialty_pool AS (
      SELECT * FROM (
        SELECT DISTINCT ON (q.question_text) q.*
        FROM questions q
        WHERE q.department_id = p_department_id
          AND q.is_common = false
          AND q.exam_type = v_exam_filter
          AND q.is_active = true
        ORDER BY q.question_text, random()
      ) deduped
      ORDER BY random()
      LIMIT v_sp_limit
    ),
    common_pool AS (
      SELECT * FROM (
        SELECT DISTINCT ON (q.question_text) q.*
        FROM questions q
        WHERE q.department_id = v_parent_id
          AND q.is_common = true
          AND q.exam_type = v_exam_filter
          AND q.is_active = true
        ORDER BY q.question_text, random()
      ) deduped
      ORDER BY random()
      LIMIT v_co_limit
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
          AND exam_type = v_exam_filter
          AND is_active = true
        ORDER BY question_text, random()
      ) deduped
      ORDER BY random()
      LIMIT v_sp_limit
    ) q;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
