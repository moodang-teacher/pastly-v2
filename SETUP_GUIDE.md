# Pastly v2 — 상세 설정 가이드

모든 단계를 순서대로 따라하면 됩니다.
예상 소요시간: 약 30~40분

---

## STEP 1. Supabase 프로젝트 만들기 (5분)

### 1-1. 가입/로그인
1. https://supabase.com 접속
2. 오른쪽 위 `Start your project` 클릭
3. GitHub 계정으로 로그인 (없으면 가입)

### 1-2. 새 프로젝트 생성
1. 대시보드에서 `New Project` 클릭
2. 입력:
   - **Organization**: 기본값 (본인 이름)
   - **Project name**: `pastly-v2`
   - **Database Password**: 강력한 비밀번호 입력 → **반드시 메모해둘 것**
   - **Region**: `Northeast Asia (Tokyo)` 선택 (한국에서 가장 빠름)
3. `Create new project` 클릭
4. 2~3분 기다리면 프로젝트 생성 완료

### 1-3. API 키 확인 (나중에 쓸 거)
1. 왼쪽 메뉴 맨 아래 ⚙️ `Project Settings` 클릭
2. `API` 탭 클릭
3. 아래 두 값을 메모장에 복사해둘 것:
   - **Project URL**: `https://xxxxxxx.supabase.co`
   - **anon public key**: `eyJhbGc...` (긴 문자열)

---

## STEP 2. 데이터베이스 테이블 만들기 (3분)

### 2-1. SQL 실행
1. Supabase 대시보드 왼쪽 메뉴 → `SQL Editor` 클릭
2. `New query` 클릭
3. 프로젝트 폴더의 `supabase/schema.sql` 파일 내용을 **전체 복사**
4. SQL Editor에 **붙여넣기**
5. 오른쪽 아래 `Run` 클릭
6. "Success. No rows returned" 메시지가 나오면 성공

### 2-2. 확인
1. 왼쪽 메뉴 → `Table Editor` 클릭
2. 아래 테이블들이 생겼는지 확인:
   - departments (6개 행이 미리 들어가 있어야 함)
   - teachers
   - cohorts
   - students
   - questions
   - attempts
   - wrong_answers

---

## STEP 3. 이미지 저장소(Storage) 만들기 (2분)

1. 왼쪽 메뉴 → `Storage` 클릭
2. `New bucket` 클릭
3. 입력:
   - **Name**: `question-images`
   - **Public bucket**: ✅ 토글 켜기
4. `Create bucket` 클릭

### Storage 정책 추가
1. 생성된 `question-images` 버킷 클릭
2. 상단 `Policies` 탭 클릭
3. `New Policy` → `For full customization` 클릭
4. 첫 번째 정책 (누구나 읽기):
   - Policy name: `Public read`
   - Allowed operation: `SELECT` 체크
   - Policy definition: `true`
   - `Review` → `Save policy`
5. 두 번째 정책 추가 (선생님만 업로드):
   - `New Policy` → `For full customization`
   - Policy name: `Teachers upload`
   - Allowed operation: `INSERT` 체크
   - Policy definition: `auth.uid() IN (SELECT user_id FROM teachers)`
   - `Review` → `Save policy`

---

## STEP 4. 구글 로그인 설정 (10분)

### 4-1. Google Cloud 프로젝트 생성
1. https://console.cloud.google.com 접속 (구글 계정 로그인)
2. 상단 프로젝트 선택 드롭다운 → `새 프로젝트`
3. 프로젝트 이름: `pastly` → `만들기`
4. 생성된 프로젝트가 선택되어 있는지 확인

### 4-2. OAuth 동의 화면 설정
1. 왼쪽 메뉴 → `API 및 서비스` → `OAuth 동의 화면`
2. User Type: `외부` 선택 → `만들기`
3. 앱 정보 입력:
   - 앱 이름: `Pastly`
   - 사용자 지원 이메일: 본인 이메일
   - 개발자 연락처: 본인 이메일
4. `저장 후 계속` 반복 (범위, 테스트 사용자는 기본값 그대로)
5. 마지막에 `대시보드로 돌아가기`

### 4-3. 앱 게시 (중요!)
1. OAuth 동의 화면 → 상단에 `앱 게시` 버튼 클릭
2. `확인` → 상태가 "프로덕션"으로 변경됨
   (이걸 안 하면 본인 외에 로그인 불가)

### 4-4. OAuth 클라이언트 ID 생성
1. 왼쪽 메뉴 → `사용자 인증 정보`
2. 상단 `+ 사용자 인증 정보 만들기` → `OAuth 클라이언트 ID`
3. 입력:
   - 애플리케이션 유형: `웹 애플리케이션`
   - 이름: `Pastly Web`
   - **승인된 자바스크립트 원본** 추가:
     - `https://xxxxxxx.supabase.co` (STEP 1에서 메모한 Project URL)
   - **승인된 리디렉션 URI** 추가:
     - `https://xxxxxxx.supabase.co/auth/v1/callback`
4. `만들기` 클릭
5. **클라이언트 ID**와 **클라이언트 보안 비밀번호** 메모

### 4-5. Supabase에 Google Provider 연결
1. Supabase 대시보드 → 왼쪽 메뉴 `Authentication`
2. `Providers` 탭 클릭
3. `Google` 펼치기 → 토글 켜기
4. 입력:
   - Client ID: 위에서 복사한 클라이언트 ID
   - Client Secret: 위에서 복사한 보안 비밀번호
5. `Save` 클릭

---

## STEP 5. 로컬에서 프로젝트 실행 (5분)

### 5-1. 프로젝트 준비
```bash
# 다운받은 pastly-v2.zip 압축 해제 후 해당 폴더로 이동
cd pastly-v2

# 의존성 설치
npm install
```

### 5-2. 환경변수 설정
```bash
# 환경변수 파일 생성
cp .env.local.example .env.local
```

`.env.local` 파일을 에디터로 열어서 수정:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...여기에_실제_키_붙여넣기
```

### 5-3. 개발 서버 실행
```bash
npm run dev
```
브라우저에서 `http://localhost:3000` 접속 → 로그인 화면이 보이면 성공!

---

## STEP 6. 선생님 계정 등록 (5분)

### 6-1. 선생님 계정 생성
각 선생님이 `http://localhost:3000/login` 에서 회원가입하거나,
Supabase 대시보드에서 직접 초대:

1. Supabase → `Authentication` → `Users` 탭
2. `Add user` → `Create new user`
3. 이메일, 비밀번호 입력 → `Create user`
4. 생성된 유저의 **UID** 확인 (클릭하면 보임)

### 6-2. teachers 테이블에 등록
Supabase → `SQL Editor` → `New query`:

```sql
-- 헤어 선생님 등록 예시
INSERT INTO teachers (user_id, name, department_id)
VALUES (
  'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',   -- 6-1에서 확인한 UID
  '김미용',                                   -- 선생님 이름
  (SELECT id FROM departments WHERE slug = 'beauty-hair')  -- 전공
);
```

각 선생님마다 반복. 전공별 slug 목록:
```
제품디자인:     'product-design'
미용-헤어:     'beauty-hair'
미용-네일:     'beauty-nail'
미용-피부:     'beauty-skin'
미용-메이크업: 'beauty-makeup'
```

6명 예시:
```sql
-- 한 번에 여러 명 등록
INSERT INTO teachers (user_id, name, department_id) VALUES
  ('uid-1', '김헤어', (SELECT id FROM departments WHERE slug = 'beauty-hair')),
  ('uid-2', '이네일', (SELECT id FROM departments WHERE slug = 'beauty-nail')),
  ('uid-3', '박피부', (SELECT id FROM departments WHERE slug = 'beauty-skin')),
  ('uid-4', '최메이크업', (SELECT id FROM departments WHERE slug = 'beauty-makeup')),
  ('uid-5', '정제품', (SELECT id FROM departments WHERE slug = 'product-design')),
  ('uid-6', '강헤어', (SELECT id FROM departments WHERE slug = 'beauty-hair'));
```

### 6-3. 관리자 페이지 접속 확인
선생님 계정으로 로그인 후 브라우저에서 직접 입력:
```
http://localhost:3000/admin
```
관리자 대시보드가 보이면 성공!
(일반 학생 계정으로는 /home으로 자동 이동됨)

---

## STEP 7. 기수 생성 + 테스트 (5분)

### 7-1. 선생님 계정으로 기수 생성
1. `/admin` 접속
2. `기수 관리` 탭
3. 이름 입력: `2025년 1기` → `생성`

### 7-2. 테스트 학생 등록
1. 시크릿/다른 브라우저에서 학생 계정으로 회원가입
2. 선생님 계정 → `학생 관리` 탭
3. "신규 가입자" 목록에 학생이 보임
4. 기수 선택 → `배정` 클릭

### 7-3. 테스트 문제 업로드
아래 내용을 `test.json` 파일로 저장:

```json
{
  "questions": [
    {
      "category": "공중위생관리학",
      "question_text": "공중위생관리법상 '위생교육'의 교육시간은?",
      "options": ["1시간", "2시간", "3시간", "4시간"],
      "answer_index": 2,
      "explanation": "공중위생관리법 시행규칙에 의거 위생교육은 3시간입니다."
    },
    {
      "category": "공중위생관리학",
      "question_text": "공중위생영업자가 지켜야 할 위생관리기준에 해당하지 않는 것은?",
      "options": ["면허증 게시", "1회용 면도날 사용", "소독된 기구 사용", "영업시간 연장"],
      "answer_index": 3,
      "explanation": "영업시간 연장은 위생관리기준과 무관합니다."
    }
  ]
}
```

1. 선생님 계정 → `문제 관리` 탭
2. 전공: 본인 전공 선택
3. 시험 유형: 기출문제
4. 미용 공통이면 **"미용 공통 과목"** 토글 켜기
5. 파일 선택 → test.json
6. "2문제가 감지되었습니다" 확인 → 업로드

### 7-4. 학생 화면 테스트
학생 계정으로 로그인 → 홈 화면에서 시험 시작 확인

---

## STEP 8. Vercel 배포 (5분)

### 8-1. GitHub에 코드 올리기
```bash
cd pastly-v2
git init
git add .
git commit -m "Pastly v2 초기 버전"

# GitHub에서 새 레포지토리 생성 후
git remote add origin https://github.com/본인계정/pastly-v2.git
git push -u origin main
```

### 8-2. Vercel에 연결
1. https://vercel.com 접속 → GitHub로 로그인
2. `Add New Project`
3. `pastly-v2` 레포지토리 선택 → `Import`
4. **Environment Variables** 섹션에서 추가:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://xxxxxxx.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `eyJhbGc...`
5. `Deploy` 클릭
6. 2~3분 후 배포 완료 → URL 확인 (예: `https://pastly-v2.vercel.app`)

### 8-3. Supabase에 배포 URL 등록 (중요!)
1. Supabase → `Authentication` → `URL Configuration`
2. **Site URL**: `https://pastly-v2.vercel.app` (Vercel에서 받은 URL)
3. **Redirect URLs** 에 추가:
   - `https://pastly-v2.vercel.app/auth/callback`
4. `Save`

### 8-4. Google OAuth에도 배포 URL 추가 (중요!)
1. Google Cloud Console → `사용자 인증 정보` → 만들어둔 OAuth 클라이언트 편집
2. **승인된 자바스크립트 원본** 추가:
   - `https://pastly-v2.vercel.app`
3. **승인된 리디렉션 URI** 추가:
   - `https://pastly-v2.vercel.app/auth/callback`
   ※ 이건 실제로는 Supabase 콜백이 처리하므로 보통 안 해도 되지만,
   혹시 문제되면 여기도 Supabase의 콜백 URL도 추가해주세요:
   - `https://xxxxxxx.supabase.co/auth/v1/callback`
4. `저장`

---

## STEP 9. 커스텀 도메인 (선택사항)

Vercel 대시보드 → 프로젝트 → `Settings` → `Domains`에서
보유 도메인을 연결할 수 있습니다. 연결 후 Supabase와 Google OAuth의
URL도 새 도메인으로 업데이트해야 합니다.

---

## 완료 후 체크리스트

- [ ] 학생이 회원가입/로그인할 수 있는가?
- [ ] 구글 로그인이 PC/Android/iOS에서 되는가?
- [ ] 선생님이 /admin 접속이 되는가?
- [ ] 선생님이 기수를 만들 수 있는가?
- [ ] 선생님이 학생을 배정할 수 있는가?
- [ ] 선생님이 JSON 문제를 업로드할 수 있는가?
- [ ] 학생이 시험을 풀 수 있는가?
- [ ] 오답 복습이 되는가?
- [ ] 명예의 전당에 랭킹이 나오는가?
- [ ] 레벨이 올라가는가?

---

## 문제가 생기면?

| 증상 | 원인 | 해결 |
|------|------|------|
| 로그인 안됨 | 환경변수 오타 | .env.local 키 확인 |
| 구글 로그인 안됨 | OAuth URL 미등록 | STEP 4-4, 8-4 재확인 |
| /admin 접속 불가 | teachers에 미등록 | STEP 6 재확인 |
| 문제가 안 나옴 | 문제 미업로드 또는 전공 불일치 | 문제의 department_id 확인 |
| "문제가 없습니다" | 풀에 문제가 부족 | 최소 60문제 이상 업로드 필요 (부족하면 있는 만큼 출제됨) |
| iOS 구글 로그인 후 멈춤 | PWA 세션 이슈 | Safari에서 직접 접속 권장 |
