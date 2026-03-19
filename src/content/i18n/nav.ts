import { text } from './shared.js'

export const navI18n = {
  nav: {
    home: text('首页', 'Home'),
    live: text('实时', 'Live'),
    replay: text('回放', 'Replay'),
    embed: text('Embed', 'Embed'),
    card: text('卡片', 'Card'),
    docs: text('文档', 'Docs'),
    about: text('关于', 'About'),
  },
} as const
