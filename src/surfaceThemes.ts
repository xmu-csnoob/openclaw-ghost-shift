export type SurfaceTheme = 'aurora' | 'ember' | 'circuit'

export interface SurfaceThemeOption {
  id: SurfaceTheme
  label: string
  description: string
}

export const surfaceThemeOptions: SurfaceThemeOption[] = [
  {
    id: 'aurora',
    label: 'Aurora',
    description: 'Cool blue gradients with soft gold highlights for the default product showcase.',
  },
  {
    id: 'ember',
    label: 'Ember',
    description: 'Warmer amber-red tones that make highlights and social cards feel more editorial.',
  },
  {
    id: 'circuit',
    label: 'Circuit',
    description: 'Sharper green-teal accents for a more technical telemetry mood.',
  },
]

export function getNextSurfaceTheme(theme: SurfaceTheme): SurfaceTheme {
  const currentIndex = surfaceThemeOptions.findIndex((option) => option.id === theme)
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % surfaceThemeOptions.length
  return surfaceThemeOptions[nextIndex].id
}
