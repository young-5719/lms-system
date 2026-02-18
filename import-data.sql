-- 엑셀 데이터를 courses 테이블에 추가
-- 날짜 형식: YY.MM.DD(요일) -> YYYY-MM-DD 변환

-- 1. 모션그래픽심화 (주말, 607호)
INSERT INTO courses (
  training_id, course_name, room_number, type, day_type,
  start_date, end_date, start_time, end_time, daily_hours,
  instructor, capacity, days_of_week, training_days
) VALUES (
  '260101',
  '모션그래픽심화/포폴 + 3D블랜더심화/포폴 + 시네마4D심화+포폴',
  '607호',
  'GENERAL',
  'WEEKEND',
  '2026-01-03',
  '2026-01-24',
  '09:30',
  '16:30',
  6,
  '조계선',
  24,
  '토',
  2
);

-- 2. AUTO CAD 건축 도면 작성 (평일, 604호)
INSERT INTO courses (
  training_id, course_name, room_number, type, day_type,
  start_date, end_date, start_time, end_time, daily_hours,
  instructor, capacity, days_of_week, training_days
) VALUES (
  '251108',
  'AUTO CAD-오토캐드를 활용한 건축 도면 작성',
  '604호',
  'EMPLOYED',
  'WEEKDAY',
  '2026-01-05',
  '2026-02-23',
  '19:00',
  '22:00',
  3,
  '정영균',
  20,
  '월수금',
  20
);

-- 3. 전산회계 1급 취득과정 (평일, 606호)
INSERT INTO courses (
  training_id, course_name, room_number, type, day_type,
  start_date, end_date, start_time, end_time, daily_hours,
  instructor, capacity, days_of_week, training_days
) VALUES (
  '260118',
  '직장인을 위한 전산회계 1급 취득과정',
  '606호',
  'EMPLOYED',
  'WEEKDAY',
  '2026-01-12',
  '2026-01-30',
  '14:30',
  '18:30',
  4,
  '맹주미',
  20,
  '월-금',
  15
);

-- 4. 정보처리 기사(필기) (평일, 607호)
INSERT INTO courses (
  training_id, course_name, room_number, type, day_type,
  start_date, end_date, start_time, end_time, daily_hours,
  instructor, capacity, days_of_week, training_days
) VALUES (
  '260104',
  '정보처리 기사(필기)',
  '607호',
  'EMPLOYED',
  'WEEKDAY',
  '2026-01-14',
  '2026-01-30',
  '19:00',
  '22:00',
  3,
  '조준모',
  20,
  '월~금',
  13
);

-- 5. GTQ1급 & GTQi1급 자격증 취득 (평일, 606호)
INSERT INTO courses (
  training_id, course_name, room_number, type, day_type,
  start_date, end_date, start_time, end_time, daily_hours,
  instructor, capacity, days_of_week, training_days
) VALUES (
  '260117',
  '출판광고편집(포토샵, 일러스트) GTQ1급 & GTQi1급 자격증 취득',
  '606호',
  'UNEMPLOYED',
  'WEEKDAY',
  '2026-01-14',
  '2026-02-20',
  '09:00',
  '14:00',
  5,
  '송현아',
  20,
  '월-금',
  25
);

-- 6. 컴퓨터활용능력2급 실기 (평일, 605호)
INSERT INTO courses (
  training_id, course_name, room_number, type, day_type,
  start_date, end_date, start_time, end_time, daily_hours,
  instructor, capacity, days_of_week, training_days
) VALUES (
  '260111',
  '[대학생 겨울방학특강] 컴퓨터활용능력2급 실기',
  '605호',
  'GENERAL',
  'WEEKDAY',
  '2026-01-16',
  '2026-01-29',
  '12:30',
  '15:30',
  3,
  '임정경',
  30,
  '월~금',
  10
);

-- 7. UX/UI 디자이너 피그마 (주말, 608호)
INSERT INTO courses (
  training_id, course_name, room_number, type, day_type,
  start_date, end_date, start_time, end_time, daily_hours,
  instructor, capacity, days_of_week, training_days
) VALUES (
  '260108',
  'UX/UI 디자이너를 위한 실무 피그마(Figma)',
  '608호',
  'EMPLOYED',
  'WEEKEND',
  '2026-01-17',
  '2026-02-28',
  '13:30',
  '19:00',
  5.5,
  '박기현',
  20,
  '토',
  6
);

-- 8. SQLD 자격 취득 과정 (주말, 609호)
INSERT INTO courses (
  training_id, course_name, room_number, type, day_type,
  start_date, end_date, start_time, end_time, daily_hours,
  instructor, capacity, days_of_week, training_days
) VALUES (
  '260109',
  'SQLD(SQL 개발자) 자격 취득 과정',
  '609호',
  'EMPLOYED',
  'WEEKEND',
  '2026-01-17',
  '2026-02-28',
  '10:00',
  '17:40',
  7,
  '방보영',
  20,
  '토',
  6
);

-- 9. 컴활2급 필기문제풀이특강 일요반 (주말, 602호)
INSERT INTO courses (
  training_id, course_name, room_number, type, day_type,
  start_date, end_date, start_time, end_time, daily_hours,
  instructor, capacity, days_of_week, training_days
) VALUES (
  '260113',
  '[대학생 겨울방학특강] 컴활2급 필기문제풀이특강 (일요반)',
  '602호',
  'GENERAL',
  'WEEKEND',
  '2026-01-18',
  '2026-01-18',
  '12:00',
  '17:00',
  5,
  '황현영',
  5,
  '일',
  1
);

-- 10. 3D 블렌더 캐릭터 모델링 (평일, 601호)
INSERT INTO courses (
  training_id, course_name, room_number, type, day_type,
  start_date, end_date, start_time, end_time, daily_hours,
  instructor, capacity, days_of_week, training_days
) VALUES (
  '260103',
  '3D 프로그램 캐릭터,모델링 입문 맛보기 과정 With 블렌더(Blender)',
  '601호',
  'EMPLOYED',
  'WEEKDAY',
  '2026-01-19',
  '2026-02-11',
  '19:00',
  '22:00',
  3,
  '박철',
  20,
  '월수금',
  11
);

-- 11. GTQi 일러스트레이터 1급 (평일, 607호) - 1/29부터 강의장 변경
INSERT INTO courses (
  training_id, course_name, room_number, type, day_type,
  start_date, end_date, start_time, end_time, daily_hours,
  instructor, capacity, days_of_week, training_days,
  change_room_number, change_start_date
) VALUES (
  '260106',
  '국가공인자격 GTQi(일러스트레이터) 1급 취득과정',
  '604호',
  'EMPLOYED',
  'WEEKDAY',
  '2026-01-19',
  '2026-02-05',
  '16:30',
  '19:00',
  2.5,
  '김태우',
  20,
  '월~금',
  14,
  '607호',
  '2026-01-29'
);

-- 12. ITQ 엑셀/파워포인트/한글 (평일, 605호)
INSERT INTO courses (
  training_id, course_name, room_number, type, day_type,
  start_date, end_date, start_time, end_time, daily_hours,
  instructor, capacity, days_of_week, training_days
) VALUES (
  '260116',
  'ITQ(엑셀,파워포인트,한글)',
  '605호',
  'GENERAL',
  'WEEKDAY',
  '2026-01-19',
  '2026-01-30',
  '15:40',
  '18:40',
  3,
  '임정경',
  30,
  '월~금',
  10
);

-- 13. GTQ 포토샵 1급 (평일, 607호)
INSERT INTO courses (
  training_id, course_name, room_number, type, day_type,
  start_date, end_date, start_time, end_time, daily_hours,
  instructor, capacity, days_of_week, training_days
) VALUES (
  '260105',
  '국가공인자격 GTQ(포토샵) 1급 취득과정',
  '607호',
  'EMPLOYED',
  'WEEKDAY',
  '2026-01-23',
  '2026-02-06',
  '12:30',
  '15:30',
  3,
  '김태우',
  20,
  '월~금',
  11
);

-- 14. 프리미어&에펙 홍보 영상 제작 (평일, 607호)
INSERT INTO courses (
  training_id, course_name, room_number, type, day_type,
  start_date, end_date, start_time, end_time, daily_hours,
  instructor, capacity, days_of_week, training_days
) VALUES (
  '260122',
  '프리미어&에펙을 활용한 홍보 영상 제작-숏폼(유튜브 쇼츠, 인스타 릴스)',
  '607호',
  'EMPLOYED',
  'WEEKDAY',
  '2026-01-23',
  '2026-02-06',
  '09:30',
  '12:30',
  3,
  '동종욱',
  20,
  '월~금',
  11
);

-- 15. 컴활2급 필기문제풀이특강 일요반 (주말, 602호)
INSERT INTO courses (
  training_id, course_name, room_number, type, day_type,
  start_date, end_date, start_time, end_time, daily_hours,
  instructor, capacity, days_of_week, training_days
) VALUES (
  '260115',
  '[대학생 겨울방학특강] 컴활2급 필기문제풀이특강 (일요반)',
  '602호',
  'GENERAL',
  'WEEKEND',
  '2026-01-25',
  '2026-01-25',
  '13:30',
  '18:30',
  5,
  '황현영',
  5,
  '일',
  1
);

-- 16. SNS 마케팅 디자인 콘텐츠 제작 (평일, 603호)
INSERT INTO courses (
  training_id, course_name, room_number, type, day_type,
  start_date, end_date, start_time, end_time, daily_hours,
  instructor, capacity, days_of_week, training_days
) VALUES (
  '260121',
  'SNS 마케팅을 위한 디자인 콘텐츠 제작 with 포토샵 실무',
  '603호',
  'EMPLOYED',
  'WEEKDAY',
  '2026-01-29',
  '2026-03-10',
  '19:00',
  '22:00',
  3,
  '이은영',
  20,
  '화목',
  11
);

-- 데이터 확인
SELECT
  training_id,
  course_name,
  room_number,
  change_room_number,
  start_date,
  end_date,
  start_time,
  end_time,
  day_type,
  instructor
FROM courses
ORDER BY start_date, start_time;
