import { useMemo } from 'react'
import * as echarts from 'echarts/core'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { LineChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsCoreOption } from 'echarts/core'
import type { MoodLog } from '../../data/types'
import { scoreByDay } from '../../lib/stats'
import { lastNDays } from '../../lib/date'
import { useChart } from './useChart'

echarts.use([GridComponent, TooltipComponent, LineChart, CanvasRenderer])

const SCORE_EMOJI = ['', '😣', '☹️', '😐', '🙂', '😊']

/** 近 30 天心情趋势：每天平均心情分（1~5），平滑折线 */
export function MoodTrend({ moodLogs, today }: { moodLogs: MoodLog[]; today: string }) {
  const option = useMemo<EChartsCoreOption>(() => {
    const days = lastNDays(30, today)
    const scores = scoreByDay(moodLogs, days)
    return {
      tooltip: {
        trigger: 'axis',
        valueFormatter: (v: number) => (v == null ? '—' : `${v} 分`),
      },
      grid: { left: 34, right: 12, top: 16, bottom: 26 },
      xAxis: {
        type: 'category',
        data: days,
        boundaryGap: false,
        axisLabel: { color: '#94a3b8', fontSize: 10, interval: 6, formatter: (v: string) => v.slice(5) },
        axisLine: { lineStyle: { color: '#FFD3A6' } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        min: 1,
        max: 5,
        interval: 1,
        axisLabel: { color: '#94a3b8', fontSize: 12, formatter: (v: number) => SCORE_EMOJI[v] ?? v },
        splitLine: { lineStyle: { color: '#FFF1E2' } },
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
          itemStyle: { color: '#F97316', borderColor: '#fff', borderWidth: 1.5 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(249,115,22,0.22)' },
                { offset: 1, color: 'rgba(249,115,22,0)' },
              ],
            },
          },
        },
      ],
    }
  }, [moodLogs, today])

  const ref = useChart(option)
  return <div ref={ref} className="h-44 w-full" />
}
