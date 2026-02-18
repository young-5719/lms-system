# LMS 시스템 설정 가이드

이 가이드는 LMS (학사 관리 시스템)을 처음부터 설정하고 실행하는 방법을 단계별로 안내합니다.

## 📋 체크리스트

- [ ] Supabase 프로젝트 생성
- [ ] 환경 변수 설정
- [ ] 데이터베이스 마이그레이션
- [ ] 관리자 계정 생성
- [ ] 개발 서버 실행

## 1️⃣ Supabase 프로젝트 생성

### 1.1 Supabase 가입 및 로그인
1. https://supabase.com 접속
2. GitHub 계정으로 로그인

### 1.2 프로젝트 생성
1. 대시보드에서 **"New Project"** 클릭
2. 다음 정보 입력:
   - **Name**: `lms-system`
   - **Database Password**: 안전한 비밀번호 생성 (예: `LMS_secure_2026!`)
     - ⚠️ **중요**: 이 비밀번호를 안전한 곳에 저장하세요!
   - **Region**: `Northeast Asia (Seoul)` 선택
   - **Pricing Plan**: Free (무료)

3. **"Create new project"** 클릭
4. 프로젝트 생성 완료까지 약 2-3분 대기

### 1.3 API 키 복사
프로젝트 생성이 완료되면:

1. 왼쪽 메뉴에서 **Settings (⚙️)** → **API** 클릭
2. 다음 정보를 복사하여 메모장에 저장:

\`\`\`
Project URL: https://abcdefghijklmnop.supabase.co
anon public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
\`\`\`

### 1.4 데이터베이스 연결 문자열 복사
1. **Settings** → **Database** 클릭
2. **Connection string** 섹션에서 **URI** 탭 선택
3. 연결 문자열 복사 (예시):
   \`\`\`
   postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
   \`\`\`
4. `[YOUR-PASSWORD]` 부분을 실제 비밀번호로 교체

## 2️⃣ 환경 변수 설정

### 2.1 환경 변수 파일 생성
프로젝트 루트 디렉토리(`~/lms-system/`)에서:

\`\`\`bash
cd ~/lms-system
touch .env.local
\`\`\`

### 2.2 환경 변수 입력
`.env.local` 파일을 열고 다음 내용을 입력:

\`\`\`env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=여기에_Project_URL_입력
NEXT_PUBLIC_SUPABASE_ANON_KEY=여기에_anon_public_key_입력

# Prisma (Supabase Database URL)
DATABASE_URL=여기에_데이터베이스_URI_입력
\`\`\`

### 2.3 예시
\`\`\`env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjQ0MDAwMCwiZXhwIjoxOTMxOTk5OTk5fQ.1234567890abcdefghijklmnopqrstuvwxyz

# Prisma
DATABASE_URL=postgresql://postgres.abcdefghijklmnop:LMS_secure_2026!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
\`\`\`

## 3️⃣ 데이터베이스 마이그레이션

### 3.1 Prisma 마이그레이션 실행
터미널에서 다음 명령어 실행:

\`\`\`bash
cd ~/lms-system

# 데이터베이스에 courses 테이블 생성
npx prisma migrate dev --name init

# Prisma Client 생성
npx prisma generate
\`\`\`

### 3.2 마이그레이션 확인
성공하면 다음과 같은 메시지가 표시됩니다:

\`\`\`
✔ Generated Prisma Client
Your database is now in sync with your schema.
\`\`\`

### 3.3 Prisma Studio로 확인 (선택 사항)
\`\`\`bash
npx prisma studio
\`\`\`

브라우저에서 http://localhost:5555 접속하여 `Course` 테이블이 생성되었는지 확인

## 4️⃣ Supabase Auth 설정

### 4.1 Email 프로바이더 활성화
1. Supabase Dashboard → **Authentication** → **Providers** 클릭
2. **Email** 프로바이더가 활성화되어 있는지 확인
   - 기본적으로 활성화되어 있음

### 4.2 이메일 확인 비활성화 (개발 편의)
1. **Authentication** → **Settings** 클릭
2. **Email Auth** 섹션에서:
   - "Enable email confirmations" → **OFF**로 설정
   - 이렇게 하면 회원가입 시 이메일 확인 없이 즉시 로그인 가능

## 5️⃣ 관리자 계정 생성

### 5.1 Supabase Dashboard에서 생성
1. Supabase Dashboard → **Authentication** → **Users** 클릭
2. **"Add user"** 버튼 클릭
3. 다음 정보 입력:
   - **Email**: admin@example.com (원하는 이메일)
   - **Password**: Admin123! (원하는 비밀번호)
   - **Auto Confirm User**: ✅ 체크
4. **"Create user"** 클릭

## 6️⃣ 개발 서버 실행

### 6.1 서버 시작
\`\`\`bash
cd ~/lms-system
npm run dev
\`\`\`

### 6.2 브라우저 접속
브라우저에서 http://localhost:3000 접속

### 6.3 로그인
1. 로그인 페이지가 자동으로 표시됨
2. 생성한 관리자 계정으로 로그인:
   - Email: admin@example.com
   - Password: Admin123!

## 7️⃣ 기능 테스트

### 7.1 대시보드 확인
로그인 후 대시보드 페이지가 표시되어야 함

### 7.2 과정 추가
1. 상단 메뉴에서 **"과정 관리"** 클릭
2. **"새 과정 추가"** 버튼 클릭
3. 필수 필드 입력:
   - 훈련ID: 12345
   - 과정명: 웹 개발 종합반
   - 훈련과정ID: WEB2024-001
   - 구분: 국기
   - 강의장: 601호
   - 개강일: 2024-03-01
   - 종강일: 2024-08-31
   - 시작시간: 09:00
   - 종료시간: 18:00
4. **"생성"** 버튼 클릭

### 7.3 빈 강의장 조회
1. **"빈 강의장"** 메뉴 클릭
2. 날짜와 시간 입력
3. **"빈 강의장 찾기"** 버튼 클릭
4. 결과 확인

### 7.4 통계 확인
1. **"통계"** 메뉴 클릭
2. 추가한 과정의 통계 확인

## 🐛 문제 해결

### "Unauthorized" 오류
**원인**: 환경 변수가 올바르지 않음

**해결**:
1. `.env.local` 파일의 URL과 키가 정확한지 확인
2. 개발 서버 재시작: `npm run dev`

### 데이터베이스 연결 오류
**원인**: DATABASE_URL이 잘못됨

**해결**:
1. Supabase Dashboard에서 Database URI 다시 복사
2. 비밀번호 부분을 정확히 교체했는지 확인
3. Prisma 재생성:
   \`\`\`bash
   npx prisma generate
   \`\`\`

### 마이그레이션 오류
**해결**:
\`\`\`bash
# 마이그레이션 초기화
npx prisma migrate reset

# 다시 마이그레이션
npx prisma migrate dev --name init
\`\`\`

### 포트 충돌 (3000번 포트 사용 중)
**해결**:
\`\`\`bash
# 다른 포트로 실행
PORT=3001 npm run dev
\`\`\`

## ✅ 완료!

축하합니다! LMS 시스템이 성공적으로 설정되었습니다. 이제 학원 운영 데이터를 관리할 수 있습니다.

## 📚 다음 단계

1. **샘플 데이터 추가**: 여러 과정을 추가하여 시스템 테스트
2. **커스터마이징**: 필요에 따라 필드 추가/수정
3. **배포**: Vercel에 배포하여 팀원들과 공유

## 💡 추가 문의

문제가 발생하면 다음을 확인하세요:
- README.md 파일
- Supabase 공식 문서: https://supabase.com/docs
- Next.js 공식 문서: https://nextjs.org/docs
