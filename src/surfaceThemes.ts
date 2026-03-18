import type { LocalizedText } from './content/locale.js'

export type SurfaceTheme = 'aurora' | 'ember' | 'circuit'

export interface SurfaceThemeOption {
  id: SurfaceTheme
  label: LocalizedText
  description: LocalizedText
}

const text = (zh: string, en: string): LocalizedText => ({ zh, en })

export const surfaceThemeOptions: SurfaceThemeOption[] = [
  {
    id: 'aurora',
    label: text('Aurora', 'Aurora'),
    description: text('冷色蓝调渐变，辅以柔和金色高光，适合默认产品展示。', 'Cool blue gradients with soft gold highlights for the default product showcase.'),
  },
  {
    id: 'ember',
    label: text('Ember', 'Ember'),
    description: text('更温暖的琥珀红色调，让高亮和社交卡片更有编辑感。', 'Warmer amber-red tones that make highlights and social cards feel more editorial.'),
  },
  {
    id: 'circuit',
    label: text('Circuit', 'Circuit'),
    description: text('更锐利的绿青色强调，营造更技术化的遥测氛围。', 'Sharper green-teal accents for a more technical telemetry mood.'),
  },
]

export function getNextSurfaceTheme(theme: SurfaceTheme): SurfaceTheme {
  const currentIndex = surfaceThemeOptions.findIndex((option) => option.id === theme)
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % surfaceThemeOptions.length
  return surfaceThemeOptions[nextIndex].id
}
