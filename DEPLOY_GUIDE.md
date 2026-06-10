# 선생님별 독립 배포 가이드

> 기준: 미용-헤어 등 단일 선생님용 독립 인스턴스 배포  
> 예상 작업 시간: **1~1.5시간**

---

## 사전 준비 (선생님에게 받을 것)

- [ ] GitHub 계정 접근권
- [ ] Vercel 계정 접근권
- [ ] Supabase 계정 접근권
- [ ] 앱 이름 (예: `헤어스터디`, `나래쌤 필기앱` 등)

---

## 1단계 — GitHub

1. 현재 레포를 선생님 GitHub 계정으로 **fork** 또는 복사
2. 레포 이름을 앱 이름에 맞게 변경 (선택)

---

## 2단계 — 코드 수정

### A. 앱 이름 변경

아래 파일들에서 `Pastly` → 새 앱 이름으로 교체

| 파일 | 수정 내용 |
|------|-----------|
| `src/app/layout.tsx` | `title`, `appleWebApp.title` |
| `public/manifest.json` | `name`, `short_name` |
| `src/app/(auth)/login/page.tsx` | `alt="Pastly"` |
| `src/app/(student)/home/page.tsx` | `alt="Pastly"` |
| `src/app/select-dept/page.tsx` | `alt="Pastly"` |
| `src/components/admin/AdminNav.tsx` | `alt="Pastly"` |
| `src/components/master/MasterNav.tsx` | `alt="Pastly"` |
| `src/components/LoadingScreen.tsx` | `alt="Pastly"` |
| `public/guide/index.html` | 제목 및 h1 텍스트 |

> 로고 이미지를 교체하려면 `public/icons/` 폴더의 아래 파일들을 교체:
> - `pastly.svg` — 헤더 로고
> - `icon.svg`, `icon-192.png`, `icon-512.png` — 앱 아이콘 (PWA 홈 화면)

---

### B. Google OAuth 제거

**`src/app/(auth)/login/page.tsx`**
- `handleGoogle` 함수 삭제
- 구글 로그인 버튼 UI 삭제

**`src/app/auth/callback/`**
- 폴더 전체 삭제 (OAuth 콜백 라우트)

> Supabase에서 Google provider를 활성화하지 않아도 됩니다.

---

## 3단계 — Supabase

### 프로젝트 생성
1. Supabase 대시보드에서 새 프로젝트 생성
2. 프로젝트 이름, 비밀번호, 리전 설정 (Seoul 권장)

### SQL 실행 (순서 반드시 지킬 것)

Supabase **SQL Editor**에서 아래 순서로 실행:

```
1. supabase/schema.sql
2. supabase/migration_add_master.sql
3. supabase/migration_rankings_require_attempts.sql
4. supabase/migration_fix_rankings.sql
5. supabase/migration_fix_quiz_dedup.sql
```

### Auth 설정
1. **Authentication → Providers** : Email 활성화 확인
2. **Authentication → URL Configuration** :
   - Site URL: `https://[배포된-vercel-도메인]`
   - Redirect URLs: 동일하게 추가

### 선생님 계정 생성
1. **Authentication → Users → Add user** 로 이메일 계정 생성
2. 생성된 UID 복사 후 SQL 실행:

```sql
-- 1. 선생님 등록 (department_id는 미용-헤어 기준)
INSERT INTO teachers (user_id, name, department_id)
VALUES (
  '여기에-UID',
  '선생님 이름',
  (SELECT id FROM departments WHERE slug = 'beauty-hair')
);

-- 2. master 권한 부여
UPDATE teachers SET is_master = true WHERE user_id = '여기에-UID';

-- 3. 혹시 student 레코드가 생겼다면 삭제
DELETE FROM students WHERE user_id = '여기에-UID';
```

---

## 4단계 — Vercel

1. Vercel에서 **Add New Project** → GitHub 레포 선택
2. **Environment Variables** 에 아래 2개 입력:

| 변수명 | 값 위치 |
|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public |

3. **Deploy** 실행

---

## 5단계 — 배포 후 확인

- [ ] 이메일 회원가입 → 로그인 정상 동작
- [ ] 과정 선택 화면에 선생님 이름 표시
- [ ] 기출문제 / Crash Test 문제 출제 (문제 업로드 후)
- [ ] 관리자 화면 접근 가능
- [ ] 앱 이름이 브라우저 탭·홈 화면 아이콘에 반영

---

## 참고: 과목별 문제 구성

| 전공 | 전공 문제 | 공통 문제 | 합계 |
|------|-----------|-----------|------|
| 미용-헤어 | 36문제 | 24문제 | 60문제 |
| 미용-피부 | 39문제 | 21문제 | 60문제 |
| 미용-네일 | 36문제 | 24문제 | 60문제 |
| 미용-메이크업 | 37문제 | 23문제 | 60문제 |

Crash Test는 기출문제 pool에서 비율 유지하며 **20문제** 출제.
