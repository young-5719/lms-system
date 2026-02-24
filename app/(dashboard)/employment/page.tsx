import EmploymentStats from '@/components/statistics/EmploymentStats'

export default function EmploymentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">취업률 현황</h2>
        <p className="text-muted-foreground">
          HRD-Net 고용보험 기준 · 국가기간전략산업직종 · 과정평가형 · 산업구조변화대응 · K-디지털 트레이닝
        </p>
      </div>
      <EmploymentStats from="2025-01-01" to="2025-12-31" />
    </div>
  )
}
