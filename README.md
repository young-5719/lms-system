# LMS (학사 관리 시스템)

학원 운영 데이터를 관리하고, 빈 강의장을 조회하며, 과정별 운영 현황을 모니터링할 수 있는 웹 애플리케이션입니다.

## 🚀 기술 스택

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL)
- **ORM**: Prisma
- **Styling**: Tailwind CSS + shadcn/ui
- **Language**: TypeScript
- **Authentication**: Supabase Auth

## ✨ 주요 기능

1. **인증 및 보안**
   - 이메일/비밀번호 기반 로그인
   - 미들웨어 기반 접근 제어

2. **대시보드**
   - 강의장별(601~610호) 탭 필터링
   - 진행 중인 과정 현황
   - 통계 카드 (전체 과정, 평균 모집률, 평균 수료율)

3. **과정 관리 (CRUD)**
   - 과정 생성, 조회, 수정, 삭제
   - 40개 이상의 상세 필드 관리
   - 필터링 및 검색 기능

4. **빈 강의장 조회**
   - 날짜/시간 기반 빈 강의장 검색
   - 사용 가능/사용 중 강의장 시각화

5. **통계**
   - 구분별(국기, KDT 등) 통계
   - 모집률/수료율 분석
   - 상위 과정 리스트

## 📋 사전 준비

### 1. Supabase 프로젝트 생성

1. [Supabase](https://supabase.com)에 접속하여 로그인
2. "New Project" 클릭
3. 프로젝트 설정:
   - **Project name**: `lms-system`
   - **Database Password**: 안전한 비밀번호 설정 (저장 필수!)
   - **Region**: `Northeast Asia (Seoul)` 선택
4. 프로젝트 생성 완료 후 다음 정보 복사:
   - Dashboard → Settings → API
   - **Project URL** 복사
   - **anon public** key 복사

### 2. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 내용을 입력:

\`\`\`env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Prisma (Supabase Database URL)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
\`\`\`

**DATABASE_URL 구성 방법:**
- Supabase Dashboard → Settings → Database → Connection string → URI 탭
- 표시된 URI를 복사하고 `[YOUR-PASSWORD]` 부분을 실제 비밀번호로 교체

## 🛠️ 설치 및 실행

### 1. 의존성 설치

\`\`\`bash
cd ~/lms-system
npm install
\`\`\`

### 2. 데이터베이스 마이그레이션

\`\`\`bash
# Prisma 초기화 (이미 완료됨)
# npx prisma init

# 데이터베이스에 스키마 적용
npx prisma migrate dev --name init

# Prisma Client 생성
npx prisma generate
\`\`\`

### 3. Supabase Auth 설정

1. Supabase Dashboard → Authentication → Providers
2. **Email** 프로바이더 활성화
3. "Confirm email" 옵션을 OFF로 설정 (개발 편의를 위해)

### 4. 관리자 계정 생성

Supabase Dashboard → Authentication → Users → "Add user" 클릭:
- Email: 원하는 이메일 주소
- Password: 안전한 비밀번호
- "Auto Confirm User" 체크

또는 코드에서 회원가입 기능을 추가할 수 있습니다.

### 5. 개발 서버 실행

\`\`\`bash
npm run dev
\`\`\`

브라우저에서 http://localhost:3000 접속

## 📁 프로젝트 구조

\`\`\`
lms-system/
├── app/
│   ├── (auth)/
│   │   ├── login/              # 로그인 페이지
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── dashboard/          # 메인 대시보드
│   │   ├── courses/            # 과정 관리
│   │   ├── empty-rooms/        # 빈 강의장 조회
│   │   ├── statistics/         # 통계
│   │   └── layout.tsx
│   ├── api/
│   │   ├── courses/            # 과정 CRUD API
│   │   └── empty-rooms/        # 빈 강의장 API
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── auth/                   # 인증 컴포넌트
│   ├── courses/                # 과정 관련 컴포넌트
│   ├── dashboard/              # 대시보드 컴포넌트
│   └── ui/                     # shadcn/ui 컴포넌트
├── lib/
│   ├── supabase/               # Supabase 클라이언트
│   ├── prisma.ts               # Prisma 클라이언트
│   └── utils.ts
├── prisma/
│   └── schema.prisma           # 데이터베이스 스키마
├── types/
│   └── course.ts               # TypeScript 타입
└── middleware.ts               # Auth 미들웨어
\`\`\`

## 🗄️ 데이터베이스 스키마

### Course 테이블

**기본 정보**
- trainingId (Unique): 훈련ID
- courseName: 과정명
- courseCodeId: 훈련과정ID
- type: 구분 (일반, 재직자, 실업자, 국기, 과평, KDT, 산대특)
- category, subCategory, detailCategory: 분류 정보

**일정 및 장소**
- roomNumber: 강의장 (601호~610호)
- startDate, endDate: 개강일, 종강일
- isWeekend: 평일/주말 구분

**시간 정보**
- startTime, endTime: 시작/종료 시간
- dailyHours, totalHours: 일일/총 시간

**인원 및 비용**
- instructor: 강사명
- capacity: 정원
- recruitmentRate: 모집률
- completionRate: 수료율

...및 기타 40+ 필드

## 🔧 유용한 명령어

\`\`\`bash
# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm start

# Prisma Studio (DB GUI)
npx prisma studio

# 데이터베이스 마이그레이션
npx prisma migrate dev

# Prisma Client 재생성
npx prisma generate
\`\`\`

## 🎯 사용 가능한 페이지

- `/login` - 로그인 페이지
- `/dashboard` - 메인 대시보드
- `/courses` - 과정 목록
- `/courses/new` - 과정 생성
- `/courses/[id]` - 과정 상세
- `/courses/[id]/edit` - 과정 수정
- `/empty-rooms` - 빈 강의장 조회
- `/statistics` - 통계

## 📝 API 엔드포인트

### 과정 관리
- `GET /api/courses` - 전체 과정 조회
- `POST /api/courses` - 과정 생성
- `GET /api/courses/[id]` - 특정 과정 조회
- `PATCH /api/courses/[id]` - 과정 수정
- `DELETE /api/courses/[id]` - 과정 삭제

### 빈 강의장
- `POST /api/empty-rooms` - 빈 강의장 검색

## 🔐 보안

- 모든 대시보드 페이지는 인증 필요
- 미들웨어를 통한 자동 리다이렉트
- API 엔드포인트에서 인증 상태 확인
- 환경 변수를 통한 민감 정보 관리

## 🚀 배포

### Vercel 배포

1. GitHub에 코드 푸시
2. [Vercel](https://vercel.com)에서 프로젝트 import
3. 환경 변수 설정 (`.env.local` 내용)
4. 배포

### 주의사항
- `.env.local` 파일은 절대 커밋하지 않기
- 프로덕션 환경에서는 적절한 비밀번호 정책 적용
- Supabase Row Level Security (RLS) 설정 고려

## 🐛 문제 해결

### 데이터베이스 연결 오류
\`\`\`bash
# Prisma Client 재생성
npx prisma generate

# 마이그레이션 재실행
npx prisma migrate reset
\`\`\`

### 인증 문제
- Supabase Dashboard에서 Auth 설정 확인
- 환경 변수가 올바른지 확인
- 브라우저 캐시 및 쿠키 삭제

## 📄 라이선스

MIT License

## 👨‍💻 개발자

LMS 학사 관리 시스템 - Claude Code로 개발됨
