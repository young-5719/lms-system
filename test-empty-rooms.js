// 빈 강의장 조회 테스트 스크립트
const testEmptyRooms = async () => {
  const testData = {
    date: '2026-02-20', // 오늘 날짜로 변경하세요
    startTime: '09:00',
    endTime: '18:00'
  };

  console.log('테스트 데이터:', testData);
  console.log('API 호출 시도...\n');

  try {
    const response = await fetch('http://localhost:3000/api/empty-rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 로그인 세션이 필요하므로 브라우저에서 실행해야 합니다
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();
    console.log('응답 상태:', response.status);
    console.log('응답 데이터:', JSON.stringify(result, null, 2));

    if (response.ok) {
      console.log('\n✅ 성공!');
      console.log(`빈 강의장: ${result.emptyRooms.join(', ')}`);
      console.log(`사용 중인 강의장: ${result.occupiedRooms.join(', ')}`);
    } else {
      console.log('\n❌ 실패:', result.error);
    }
  } catch (error) {
    console.error('❌ 에러 발생:', error.message);
  }
};

// Node.js 환경에서 실행
if (typeof window === 'undefined') {
  // fetch 폴리필
  const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
  global.fetch = fetch;
}

testEmptyRooms();
