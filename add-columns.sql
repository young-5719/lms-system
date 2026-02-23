-- courses 테이블에 필요한 컬럼 추가

-- day_type 컬럼 추가 (평일/주말 구분)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS day_type TEXT;

-- change_room_number 컬럼 추가 (강의장 변경)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS change_room_number TEXT;

-- change_start_date 컬럼 추가 (강의장 변경 시작일)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS change_start_date DATE;

-- days_of_week 컬럼 추가 (요일 정보)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS days_of_week TEXT;

-- training_days 컬럼 추가 (훈련 일수)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS training_days INTEGER;

-- 컬럼 추가 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'courses'
ORDER BY ordinal_position;
