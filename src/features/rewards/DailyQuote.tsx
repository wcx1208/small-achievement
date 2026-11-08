import { quoteOfTheDay } from '../../data/quotes'
import { todayStr } from '../../lib/date'

/** 每日一签：按日期确定性轮换，当天固定同一句（衬线引言卡样式借鉴六级单词 App） */
export function DailyQuote() {
  const q = quoteOfTheDay(todayStr())
  return (
    <div className="rounded-3xl bg-white/70 px-5 py-4 shadow-sm backdrop-blur-sm dark:bg-slate-900/70">
      <p className="font-serif text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
        <span className="mr-0.5 align-top text-2xl leading-none text-orange-300">“</span>
        {q}
        <span className="ml-0.5 align-top text-2xl leading-none text-orange-300">”</span>
      </p>
      <p className="mt-1 text-right text-[10px] tracking-widest text-slate-300 dark:text-slate-600">—— 每日一签</p>
    </div>
  )
}
