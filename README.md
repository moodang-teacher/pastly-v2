# Pastly v2 — 개발자 설정 가이드

## 기술 스택
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Supabase (Auth + PostgreSQL + Storage)
- **배포**: Vercel

---

## 1. Supabase 프로젝트 설정

### 1-1. 프로젝트 생성
1. https://supabase.com 접속 → 새 프로젝트 생성
2. 프로젝트명: `pastly-v2`

### 1-2. DB 스키마 적용
Supabase 대시보드 → **SQL Editor** → `supabase/schema.sql` 내용 전체 붙여넣기 후 실행

### 1-3. Google OAuth 설정
1. [Google Cloud Console](https://console.cloud.google.com) → 새 프로젝트
2. APIs & Services → OAuth 동의 화면 설정
3. 사용자 인증 정보 → OAuth 2.0 클라이언트 ID 생성 (웹 애플리케이션)
   - 승인된 자바스크립트 원본: `https://your-project.supabase.co`
   - 승인된 리디렉션 URI: `https://your-project.supabase.co/auth/v1/callback`
4. Supabase 대시보드 → Authentication → Providers → Google 활성화
   - Client ID, Client Secret 입력

### 1-4. Storage 버킷 생성 (문제 이미지용)
Supabase 대시보드 → Storage → New Bucket
- Name: `question-images`
- Public bucket: ✅ 체크

### 1-5. 선생님 계정 등록 (직접 등록)
Supabase 대시보드 → Authentication → Users → Invite user로 선생님 이메일 초대 후,
SQL Editor에서 teachers 테이블에 직접 삽입:

```sql
-- 예시: 헤어 선생님 등록
INSERT INTO teachers (user_id, name, department_id)
VALUES (
  '선생님-uid-여기에',  -- Authentication > Users에서 확인
  '홍길동',
  (SELECT id FROM departments WHERE slug = 'beauty-hair')
);
```

---

## 2. 로컬 개발 환경

```bash
# 의존성 설치
npm install

# 환경변수 설정
cp .env.local.example .env.local
# .env.local 파일 열어서 Supabase URL과 Key 입력

# 개발 서버 실행
npm run dev
```

---

## 3. Vercel 배포

```bash
# Vercel CLI 설치
npm i -g vercel

# 배포
vercel

# 환경변수 설정 (Vercel 대시보드 또는 CLI)
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Vercel 대시보드 → Settings → Environment Variables에도 동일하게 추가

### Supabase Auth에 Vercel URL 등록
Supabase → Authentication → URL Configuration
- Site URL: `https://your-app.vercel.app`
- Redirect URLs: `https://your-app.vercel.app/auth/callback`

---

## 4. 전공 구조 (departments 테이블)

```
제품디자인       slug: product-design  (60문제, 단일)
미용             slug: beauty           (공통 부모)
 ├ 미용-헤어     slug: beauty-hair      (전공36 + 공통24)
 ├ 미용-네일     slug: beauty-nail      (전공36 + 공통24)
 ├ 미용-피부     slug: beauty-skin      (전공39 + 공통21)
 └ 미용-메이크업 slug: beauty-makeup    (전공37 + 공통23)
```

---

## 5. 디렉토리 구조

```
src/
├── app/
│   ├── (auth)/login/         # 로그인 페이지
│   ├── (student)/
│   │   ├── home/             # 학생 메인 화면
│   │   └── quiz/             # 퀴즈 화면
│   ├── admin/
│   │   ├── page.tsx          # 관리자 대시보드
│   │   ├── questions/        # 문제 업로드/관리
│   │   ├── students/         # 학생 관리
│   │   ├── cohorts/          # 기수 관리
│   │   └── reset/            # 초기화
│   └── auth/callback/        # OAuth 콜백
├── components/
│   └── admin/AdminNav.tsx    # 관리자 네비게이션
├── lib/supabase/
│   ├── client.ts             # 브라우저 클라이언트
│   └── server.ts             # 서버 클라이언트
├── types/index.ts            # 전역 타입 + 레벨 시스템
└── middleware.ts             # 인증 미들웨어
```
