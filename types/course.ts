// TypeScript 타입 정의

export enum CourseType {
  GENERAL = '일반',
  EMPLOYED = '재직자',
  UNEMPLOYED = '실업자',
  NATIONAL = '국기',
  ASSESSMENT = '과평',
  KDT = 'KDT',
  INDUSTRY = '산대특',
}

export enum DayType {
  WEEKDAY = '평일',
  WEEKEND = '주말',
}

export interface Course {
  id: number;

  // 기본 정보
  trainingId: number;
  courseName: string;
  courseCodeId: string;
  ncsCode?: string | null;
  round?: number | null;
  category?: string | null;
  type: keyof typeof CourseType;
  subCategory?: string | null;
  detailCategory?: string | null;
  strategicField?: string | null;

  // 일정 및 장소
  isWeekend: keyof typeof DayType;
  roomNumber: string;
  startDate: Date;
  endDate: Date;
  dayOfWeek?: string | null;
  trainingDays?: number | null;
  lectureDays?: string | null;
  holidays?: string | null;

  // 시간 정보
  startTime: string;
  endTime: string;
  dailyHours?: number | null;
  totalHours?: number | null;
  lunchStart?: string | null;
  lunchEnd?: string | null;

  // 인원 및 비용
  instructor?: string | null;
  employmentManager?: string | null;
  capacity?: number | null;
  tuition?: number | null;
  currentStudentsGov?: number | null;
  currentStudentsGen?: number | null;
  recruitmentRate?: number | null;
  dropouts?: number | null;
  completionCount?: number | null;
  completionRate?: number | null;

  // 특강 및 행사
  specialLecture1?: string | null;
  specialLecture1Time?: number | null;
  specialLecture2?: string | null;
  specialLecture2Time?: number | null;
  presentationDate?: Date | null;
  presentationTime?: number | null;

  // 운영 변동 사항
  changeStartDate?: Date | null;
  changedRoom?: string | null;
  scheduleChange?: string | null;
  operationNote?: string | null;

  // 타임스탬프
  createdAt: Date;
  updatedAt: Date;
}

export type CreateCourseInput = Omit<Course, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateCourseInput = Partial<CreateCourseInput>;
