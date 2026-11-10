import { useMemo } from 'react'
import * as echarts from 'echarts/core'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { LineChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsCoreOption } from 'echarts/core'
import type { MoodLog } from '../../data/types'
import { scoreByDay } from '../../lib/stats'
import { lastNDays } from '../../lib/date'
import { useChart, useIsDark } from './useChart'

echarts.use([GridComponent, TooltipComponent, LineChart, CanvasRenderer])

const SCORE_EMOJI = ['', '😣', '☹️', '😐', '🙂', '😊']

/** 近 30 天心情趋势：深浅色自适应轴标签、网格线与 tooltip */
export function MoodTrend({ moodLogs, today }: { moodLogs: MoodLog[]; today: string }) {
  const isDark = useIsDark()

  const option = useMemo<EChartsCoreOption>(() => {
    const days = lastNDays(30, today)
    const scores = scoreByDay(moodLogs, days)
    const labelColor = isDark ? '#cbd5e1' : '#64748b'
    const axisLineColor = isDark ? '#475569' : '#FED7AA'
    const splitLineColor = isDark ? 'rgba(51, 65, 85, 0.55)' : '#FFF1E2'

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.96)',
        borderColor: isDark ? '#334155' : '#fed7aa',
        textStyle: { color: isDark ? '#f1f5f9' : '#1e293b', fontSize: 12 },
        valueFormatter: (v: number) => (v == null ? '未记录' : `${v} 分`),
      },
      grid: { left: 36, right: 12, top: 16, bottom: 26 },
      xAxis: {
        type: 'category',
        data: days,
        boundaryGap: false,
        axisLabel: { color: labelColor, fontSize: 11, interval: 6, formatter: (v: string) => v.slice(5) },
        axisLine: { lineStyle: { color: axisLineColor } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        min: 1,
        max: 5,
        interval: 1,
        axisLabel: { color: labelColor, fontSize: 12, formatter: (v: number) => SCORE_EMOJI[v] ?? v },
        splitLine: { lineStyle: { color: splitLineColor } },
      },
      series: [
        {
          type: 'line',
          smooth: true,
          connectNulls: true,
          data: scores,
          symbol: 'circle',
          symbolSize: 7,
          lineStyle: { color: '#F97316', width: 3 },
          itemStyle: {
            color: '#F97316',
            borderColor: isDark ? '#0f172a' : '#fff',
            borderWidth: 1.5,
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: isDark ? 'rgba(249,115,22,0.32)' : 'rgba(249,115,22,0.22)' },
                { offset: 1, color: 'rgba(249,115,22,0)' },
              ],
            },
          },
        },
      ],
    }
  }, [moodLogs, today, isDark])

  const ref = useChart(option)
  return <div ref={ref} className="h-44 w-full" />
}
