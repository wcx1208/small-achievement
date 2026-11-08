/** 鼓励文案库：语气像朋友，真诚不说教。打卡与记录心情各用一个池子 */

const TASK_QUOTES = [
  '完成啦！这就是说到做到的感觉 👏',
  '又向前一小步，今天的你很有力量。',
  '小事做到了，这本身就是在照顾自己呀。',
  '干得漂亮！给自己比个心 ❤️',
  '记住此刻的轻松感，下次没动力时回来看看。',
  '你不需要做到完美，来了、做了，就很棒。',
  '一步一步来，你已经在路上了。',
  '慢慢来，比较快。今天又进了一步。',
  '这个任务被你轻松拿下，真稳！',
  '每一次打卡，都是在给未来的自己存礼物 🎁',
  '今天的你，值得一个大大的拥抱 🤗',
  '别小看这一件小事，它就是你说了算的证据。',
  '完成的一瞬间，有没有那么一点点开心？',
  '进度条又动了一格，真心为你高兴！',
  '今天也在认真生活，这很了不起。',
  '做完了就放下，好好休息一下呗 ☕',
  '这波操作行云流水，给未来的你打了个样。',
  '你和拖延之间，又赢了一回合 💪',
  '把任务划掉的这一下，爽吧！',
  '又一件小事被你搞定，稳稳的幸福感。',
  '今天的事今天毕，你做到了。',
  '有点了不起啊，坚持正在悄悄改变你。',
  '不管结果怎样，行动本身就值得鼓掌。',
  '嘿，又攒下一个小成就，攒着攒着就多了。',
]

const MOOD_QUOTES = [
  '谢谢你愿意记录此刻的感受，这很重要 🌱',
  '情绪没有对错，看见它就是照顾自己。',
  '记下来的心情，以后回看会很有意思的。',
  '今天的感受已收好，明天也在这里等你。',
  '无论今天过得怎样，你都已经很努力了。',
  '心情不好也没关系，给自己一点时间。',
  '每一次记录，都是和自己的一次对话 ✨',
  '感谢你诚实地面对自己，这需要勇气。',
  '你的感受值得被认真对待，包括被你自己。',
  '写下来的瞬间，心里是不是轻了一点？',
  '平静也好，起伏也罢，都是真实可爱的你。',
  '情绪来了又走，而你一直都在。',
  '今天的记录完成，睡前的小仪式感 🌙',
  '累了就歇歇，记录已经做得很好了。',
]

function pick(list: string[], exclude?: string): string {
  let q = list[Math.floor(Math.random() * list.length)]
  // 避免连续两次抽到同一条
  if (exclude && list.length > 1) {
    let guard = 0
    while (q === exclude && guard < 5) {
      q = list[Math.floor(Math.random() * list.length)]
      guard++
    }
  }
  return q
}

/** 每日一签：按日期确定性轮换（借鉴六级单词 App：同一天固定同一句，刷新不闪变） */
export function quoteOfTheDay(ds: string): string {
  const all = [...TASK_QUOTES, ...MOOD_QUOTES]
  let h = 0
  for (let i = 0; i < ds.length; i++) h = (h * 31 + ds.charCodeAt(i)) >>> 0
  return all[h % all.length]
}

export function pickQuote(kind: 'task' | 'mood', exclude?: string): string {
  return pick(kind === 'task' ? TASK_QUOTES : MOOD_QUOTES, exclude)
}
