// Supabase에 과정 데이터 추가 스크립트
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://iqhagdoldbitwrxrzzmh.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxaGFnZG9sZGJpdHdyeHJ6em1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MjQ0MjAsImV4cCI6MjA4NzAwMDQyMH0.RMxL6lQ3DSHgsUiwr3EDLwbfak8gvi_3HiUteQb8eyw'

const supabase = createClient(supabaseUrl, supabaseKey)

const courses = [
  {
    training_id: '260101',
    course_name: '모션그래픽심화/포폴 + 3D블랜더심화/포폴 + 시네마4D심화+포폴',
    room_number: '607호',
    type: 'GENERAL',
    day_type: 'WEEKEND',
    start_date: '2026-01-03',
    end_date: '2026-01-24',
    start_time: '09:30',
    end_time: '16:30',
    daily_hours: 6,
    instructor: '조계선',
    capacity: 24,
    days_of_week: '토',
    training_days: 2
  },
  {
    training_id: '251108',
    course_name: 'AUTO CAD-오토캐드를 활용한 건축 도면 작성',
    room_number: '604호',
    type: 'EMPLOYED',
    day_type: 'WEEKDAY',
    start_date: '2026-01-05',
    end_date: '2026-02-23',
    start_time: '19:00',
    end_time: '22:00',
    daily_hours: 3,
    instructor: '정영균',
    capacity: 20,
    days_of_week: '월수금',
    training_days: 20
  },
  {
    training_id: '260118',
    course_name: '직장인을 위한 전산회계 1급 취득과정',
    room_number: '606호',
    type: 'EMPLOYED',
    day_type: 'WEEKDAY',
    start_date: '2026-01-12',
    end_date: '2026-01-30',
    start_time: '14:30',
    end_time: '18:30',
    daily_hours: 4,
    instructor: '맹주미',
    capacity: 20,
    days_of_week: '월-금',
    training_days: 15
  },
  {
    training_id: '260104',
    course_name: '정보처리 기사(필기)',
    room_number: '607호',
    type: 'EMPLOYED',
    day_type: 'WEEKDAY',
    start_date: '2026-01-14',
    end_date: '2026-01-30',
    start_time: '19:00',
    end_time: '22:00',
    daily_hours: 3,
    instructor: '조준모',
    capacity: 20,
    days_of_week: '월~금',
    training_days: 13
  },
  {
    training_id: '260117',
    course_name: '출판광고편집(포토샵, 일러스트) GTQ1급 & GTQi1급 자격증 취득',
    room_number: '606호',
    type: 'UNEMPLOYED',
    day_type: 'WEEKDAY',
    start_date: '2026-01-14',
    end_date: '2026-02-20',
    start_time: '09:00',
    end_time: '14:00',
    daily_hours: 5,
    instructor: '송현아',
    capacity: 20,
    days_of_week: '월-금',
    training_days: 25
  },
  {
    training_id: '260111',
    course_name: '[대학생 겨울방학특강] 컴퓨터활용능력2급 실기',
    room_number: '605호',
    type: 'GENERAL',
    day_type: 'WEEKDAY',
    start_date: '2026-01-16',
    end_date: '2026-01-29',
    start_time: '12:30',
    end_time: '15:30',
    daily_hours: 3,
    instructor: '임정경',
    capacity: 30,
    days_of_week: '월~금',
    training_days: 10
  },
  {
    training_id: '260108',
    course_name: 'UX/UI 디자이너를 위한 실무 피그마(Figma)',
    room_number: '608호',
    type: 'EMPLOYED',
    day_type: 'WEEKEND',
    start_date: '2026-01-17',
    end_date: '2026-02-28',
    start_time: '13:30',
    end_time: '19:00',
    daily_hours: 5.5,
    instructor: '박기현',
    capacity: 20,
    days_of_week: '토',
    training_days: 6
  },
  {
    training_id: '260109',
    course_name: 'SQLD(SQL 개발자) 자격 취득 과정',
    room_number: '609호',
    type: 'EMPLOYED',
    day_type: 'WEEKEND',
    start_date: '2026-01-17',
    end_date: '2026-02-28',
    start_time: '10:00',
    end_time: '17:40',
    daily_hours: 7,
    instructor: '방보영',
    capacity: 20,
    days_of_week: '토',
    training_days: 6
  },
  {
    training_id: '260113',
    course_name: '[대학생 겨울방학특강] 컴활2급 필기문제풀이특강 (일요반)',
    room_number: '602호',
    type: 'GENERAL',
    day_type: 'WEEKEND',
    start_date: '2026-01-18',
    end_date: '2026-01-18',
    start_time: '12:00',
    end_time: '17:00',
    daily_hours: 5,
    instructor: '황현영',
    capacity: 5,
    days_of_week: '일',
    training_days: 1
  },
  {
    training_id: '260103',
    course_name: '3D 프로그램 캐릭터,모델링 입문 맛보기 과정 With 블렌더(Blender)',
    room_number: '601호',
    type: 'EMPLOYED',
    day_type: 'WEEKDAY',
    start_date: '2026-01-19',
    end_date: '2026-02-11',
    start_time: '19:00',
    end_time: '22:00',
    daily_hours: 3,
    instructor: '박철',
    capacity: 20,
    days_of_week: '월수금',
    training_days: 11
  },
  {
    training_id: '260106',
    course_name: '국가공인자격 GTQi(일러스트레이터) 1급 취득과정',
    room_number: '604호',
    type: 'EMPLOYED',
    day_type: 'WEEKDAY',
    start_date: '2026-01-19',
    end_date: '2026-02-05',
    start_time: '16:30',
    end_time: '19:00',
    daily_hours: 2.5,
    instructor: '김태우',
    capacity: 20,
    days_of_week: '월~금',
    training_days: 14,
    change_room_number: '607호',
    change_start_date: '2026-01-29'
  },
  {
    training_id: '260116',
    course_name: 'ITQ(엑셀,파워포인트,한글)',
    room_number: '605호',
    type: 'GENERAL',
    day_type: 'WEEKDAY',
    start_date: '2026-01-19',
    end_date: '2026-01-30',
    start_time: '15:40',
    end_time: '18:40',
    daily_hours: 3,
    instructor: '임정경',
    capacity: 30,
    days_of_week: '월~금',
    training_days: 10
  },
  {
    training_id: '260105',
    course_name: '국가공인자격 GTQ(포토샵) 1급 취득과정',
    room_number: '607호',
    type: 'EMPLOYED',
    day_type: 'WEEKDAY',
    start_date: '2026-01-23',
    end_date: '2026-02-06',
    start_time: '12:30',
    end_time: '15:30',
    daily_hours: 3,
    instructor: '김태우',
    capacity: 20,
    days_of_week: '월~금',
    training_days: 11
  },
  {
    training_id: '260122',
    course_name: '프리미어&에펙을 활용한 홍보 영상 제작-숏폼(유튜브 쇼츠, 인스타 릴스)',
    room_number: '607호',
    type: 'EMPLOYED',
    day_type: 'WEEKDAY',
    start_date: '2026-01-23',
    end_date: '2026-02-06',
    start_time: '09:30',
    end_time: '12:30',
    daily_hours: 3,
    instructor: '동종욱',
    capacity: 20,
    days_of_week: '월~금',
    training_days: 11
  },
  {
    training_id: '260115',
    course_name: '[대학생 겨울방학특강] 컴활2급 필기문제풀이특강 (일요반)',
    room_number: '602호',
    type: 'GENERAL',
    day_type: 'WEEKEND',
    start_date: '2026-01-25',
    end_date: '2026-01-25',
    start_time: '13:30',
    end_time: '18:30',
    daily_hours: 5,
    instructor: '황현영',
    capacity: 5,
    days_of_week: '일',
    training_days: 1
  },
  {
    training_id: '260121',
    course_name: 'SNS 마케팅을 위한 디자인 콘텐츠 제작 with 포토샵 실무',
    room_number: '603호',
    type: 'EMPLOYED',
    day_type: 'WEEKDAY',
    start_date: '2026-01-29',
    end_date: '2026-03-10',
    start_time: '19:00',
    end_time: '22:00',
    daily_hours: 3,
    instructor: '이은영',
    capacity: 20,
    days_of_week: '화목',
    training_days: 11
  }
]

async function insertData() {
  console.log('🚀 Supabase에 과정 데이터 추가 시작...\n')

  for (const course of courses) {
    console.log(`📝 추가 중: ${course.training_id} - ${course.course_name}`)

    const { data, error } = await supabase
      .from('courses')
      .insert([course])
      .select()

    if (error) {
      console.error(`❌ 에러 (${course.training_id}):`, error.message)
    } else {
      console.log(`✅ 성공: ${course.training_id}\n`)
    }
  }

  console.log('\n✨ 모든 데이터 추가 완료!')

  // 데이터 확인
  const { data: allCourses, error: fetchError } = await supabase
    .from('courses')
    .select('training_id, course_name, room_number, start_date, end_date')
    .order('start_date')

  if (fetchError) {
    console.error('데이터 조회 에러:', fetchError)
  } else {
    console.log(`\n📊 총 ${allCourses.length}개의 과정이 등록되어 있습니다:`)
    allCourses.forEach(c => {
      console.log(`  - ${c.training_id}: ${c.course_name} (${c.room_number})`)
    })
  }
}

insertData().catch(console.error)
