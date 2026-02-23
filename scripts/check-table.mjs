// Supabase 테이블 구조 확인
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://iqhagdoldbitwrxrzzmh.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxaGFnZG9sZGJpdHdyeHJ6em1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MjQ0MjAsImV4cCI6MjA4NzAwMDQyMH0.RMxL6lQ3DSHgsUiwr3EDLwbfak8gvi_3HiUteQb8eyw'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkTable() {
  console.log('📋 courses 테이블 조회 중...\n')

  // 샘플 데이터 조회
  const { data: sample, error } = await supabase
    .from('courses')
    .select('*')
    .limit(1)

  if (error) {
    console.error('❌ 에러:', error.message)
    return
  }

  if (sample && sample.length > 0) {
    console.log('✅ 테이블 구조 (첫 번째 레코드의 컬럼):')
    console.log(Object.keys(sample[0]).join(', '))
    console.log('\n샘플 데이터:')
    console.log(JSON.stringify(sample[0], null, 2))
  } else {
    console.log('⚠️ 테이블에 데이터가 없습니다.')
  }

  // 전체 개수 확인
  const { count } = await supabase
    .from('courses')
    .select('*', { count: 'exact', head: true })

  console.log(`\n총 레코드 수: ${count}개`)
}

checkTable().catch(console.error)
