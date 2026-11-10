import { useMemo } from 'react'
import * as echarts from 'echarts/core'
import { CalendarComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'
import { HeatmapChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsCoreOption } from 'echarts/core'
import type { CheckIn } from '../../data/types'
import { countsByDay } from '../../lib/stats'
import { lastNDays } from '../../lib/date'
import { useChart, useIsDark } from './useChart'

echarts.use([CalendarComponent, TooltipComponent, VisualMapComponent, HeatmapChart, CanvasRenderer])

/** 近 90 天打卡热力图：深浅色自适应，空格子与热力色阶在深浅色下均协调清晰 */
export function Heatmap({ checkIns, today }: { checkIns: CheckIn[]; today: string }) {
  const isDark = useIsDark()

  const option = useMemo<EChartsCoreOption>(() => {
    const days = lastNDays(90, today)
    const counts = countsByDay(checkIns)
    const data = days.map((d) => [d, counts[d] ?? 0])
    const max = Math.max(1, ...data.map((x) => x[1] as number))

    const emptyCellColor = isDark ? 'rgba(51, 65, 85, 0.55)' : '#FFF3E6'
    const labelColor = isDark ? '#cbd5e1' : '#64748b'
    const rangeColors = isDark
      ? ['rgba(51, 65, 85, 0.55)', '#7c2d12', '#c2410c', '#ea580c', '#fb923c']
      : ['#FFF3E6', '#FFD8B0', '#FFB36B', '#F97316', '#EA580C']

    return {
      tooltip: {
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.96)',
        borderColor: isDark ? '#334155' : '#fed7aa',
        textStyle: { color: isDark ? '#f1f5f9' : '#1e293b', fontSize: 12 },
        formatter: (p: { value: [string, number] }) => `${p.value[0]} · 打卡 ${p.value[1]} 次`,
      },
      visualMap: {
        show: false,
        min: 0,
        max,
        inRange: { color: rangeColors },
      },
      calendar: {
        range: [days[0], today],
        cellSize: [13, 13],
        orient: 'horizontal',
        itemStyle: { color: emptyCellColor, borderWidth: 3, borderColor: 'transparent' },
        dayLabel: {
          firstDay: 1,
          nameMap: ['日', '一', '二', '三', '四', '五', '六'],
          color: labelColor,
          fontSize: 11,
        },
        monthLabel: { color: labelColor, fontSize: 11, nameMap: 'cn' },
        yearLabel: { show: false },
        splitLine: { show: false },
        left: 28,
        top: 24,
        right: 6,
      },
      series: [
        {
          type: 'heatmap',
          coordinateSystem: 'calendar',
          data,
          itemStyle: { borderRadius: 3 },
        },
      ],
    }
  }, [checkIns, today, isDark])

  const ref = useChart(option)
  return <div ref={ref} className="h-44 w-full" />
}
