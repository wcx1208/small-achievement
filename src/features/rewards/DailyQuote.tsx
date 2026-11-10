import { quoteOfTheDay } from '../../data/quotes'
import { todayStr } from '../../lib/date'

/** 每日一签（今日页底部温柔彩蛋）：按日期确定性轮换，当天固定同一句 */
export function DailyQuote() {
  const q = quoteOfTheDay(todayStr())
  return (
    <section
      aria-label="每日一签彩蛋"
      className="card bg-white/75! dark:bg-slate-900/75!"
    >
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>🎁 今日底部小彩蛋 · 每日一签</span>
        <span>送给认真的你</span>
      </div>
      <p className="mt-2 font-serif text-[15px] leading-relaxed text-slate-700 dark:text-slate-200">
        <span className="mr-1 align-top text-xl leading-none text-orange-400">“</span>
        {q}
        <span className="ml-1 align-top text-xl leading-none text-orange-400">”</span>
      </p>
    </section>
  )
}
