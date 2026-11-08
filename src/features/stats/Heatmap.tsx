import { useMemo } from 'react'
import * as echarts from 'echarts/core'
import { CalendarComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'
import { HeatmapChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsCoreOption } from 'echarts/core'
import type { CheckIn } from '../../data/types'
import { countsByDay } from '../../lib/stats'
import { lastNDays } from '../../lib/date'
import { useChart } from './useChart'

echarts.use([CalendarComponent, TooltipComponent, VisualMapComponent, HeatmapChart, CanvasRenderer])

/** 近 90 天打卡热力图：颜色越深当天完成越多 */
export function Heatmap({ checkIns, today }: { checkIns: CheckIn[]; today: string }) {
  const option = useMemo<EChartsCoreOption>(() => {
    const days = lastNDays(90, today)
    const counts = countsByDay(checkIns)
    const data = days.map((d) => [d, counts[d] ?? 0])
    const max = Math.max(1, ...data.map((x) => x[1] as number))
    return {
      tooltip: {
        formatter: (p: { value: [string, number] }) => `${p.value[0]} · 打卡 ${p.value[1]} 次`,
      },
      visualMap: {
        show: false,
        min: 0,
        max,
        inRange: { color: ['#FFE9D2', '#FFD3A6', '#FFB066', '#FF8A3D', '#F2640C'] },
      },
      calendar: {
        range: [days[0], today],
        cellSize: [13, 13],
        orient: 'horizontal',
        itemStyle: { color: 'rgba(148,163,184,0.3)', borderWidth: 3, borderColor: 'transparent' },
        dayLabel: { firstDay: 1, nameMap: ['日', '一', '二', '三', '四', '五', '六'], color: '#94a3b8', fontSize: 10 },
        monthLabel: { color: '#94a3b8', fontSize: 10, nameMap: 'cn' },
        yearLabel: { show: false },
        splitLine: { show: false },
        left: 26,
        top: 22,
        right: 4,
      },
      series: [{ type: 'heatmap', coordinateSystem: 'calendar', data, itemStyle: { borderRadius: 3 } }],
    }
  }, [checkIns, today])

  const ref = useChart(option)
  return <div ref={ref} className="h-44 w-full" />
}
