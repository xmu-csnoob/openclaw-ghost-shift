import type { SurfaceExperiencePreferences } from './ExperiencePanel.js'
import { surfaceThemeOptions } from '../surfaceThemes.js'

export interface SettingsContentProps {
  preferences: SurfaceExperiencePreferences
  onThemeChange: (theme: SurfaceExperiencePreferences['theme']) => void
  onDensityChange: (density: SurfaceExperiencePreferences['density']) => void
  onAutoSharePreviewChange: (enabled: boolean) => void
  onCoachTipsChange: (enabled: boolean) => void
}

export function SettingsContent({
  preferences,
  onThemeChange,
  onDensityChange,
  onAutoSharePreviewChange,
  onCoachTipsChange,
}: SettingsContentProps) {
  return (
    <>
      <div className="gs-settings-group">
        <span className="gs-settings-group__label">颜色主题</span>
        <div className="gs-theme-switcher" role="list" aria-label="颜色主题">
          {surfaceThemeOptions.map((option) => (
            <button
              type="button"
              key={option.id}
              className={preferences.theme === option.id ? 'is-active' : ''}
              onClick={() => onThemeChange(option.id)}
            >
              <strong>{option.label}</strong>
              <span>{option.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="gs-settings-group">
        <span className="gs-settings-group__label">密度</span>
        <div className="gs-toggle-row">
          <button
            type="button"
            className={preferences.density === 'comfortable' ? 'is-active' : ''}
            onClick={() => onDensityChange('comfortable')}
          >
            舒适
          </button>
          <button
            type="button"
            className={preferences.density === 'compact' ? 'is-active' : ''}
            onClick={() => onDensityChange('compact')}
          >
            紧凑
          </button>
        </div>
      </div>

      <div className="gs-settings-group">
        <span className="gs-settings-group__label">行为</span>
        <div className="gs-toggle-stack">
          <label className="gs-check-row">
            <input
              type="checkbox"
              checked={preferences.autoSharePreview}
              onChange={(event) => onAutoSharePreviewChange(event.target.checked)}
            />
            <span>当框架更改时自动刷新分享预览</span>
          </label>
          <label className="gs-check-row">
            <input
              type="checkbox"
              checked={preferences.coachTips}
              onChange={(event) => onCoachTipsChange(event.target.checked)}
            />
            <span>默认展开指南提示</span>
          </label>
        </div>
      </div>
    </>
  )
}
