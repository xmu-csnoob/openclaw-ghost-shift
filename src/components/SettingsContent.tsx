import type { SurfaceExperiencePreferences } from './ExperiencePanel.js'
import { surfaceThemeOptions } from '../surfaceThemes.js'
import { i18n } from '../content/i18n/index.js'
import { setLocale, useLocale, useT } from '../content/locale.js'

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
  const locale = useLocale()
  const tt = useT()

  return (
    <>
      <div className="gs-settings-group">
        <span className="gs-settings-group__label">{tt(i18n.experience.settings.language)}</span>
        <div className="gs-toggle-row" role="group" aria-label={tt(i18n.experience.settings.language)}>
          <button
            type="button"
            className={locale === 'zh' ? 'is-active' : ''}
            onClick={() => setLocale('zh')}
          >
            {tt(i18n.localeSwitcher.zh)}
          </button>
          <button
            type="button"
            className={locale === 'en' ? 'is-active' : ''}
            onClick={() => setLocale('en')}
          >
            {tt(i18n.localeSwitcher.en)}
          </button>
        </div>
      </div>

      <div className="gs-settings-group">
        <span className="gs-settings-group__label">{tt(i18n.experience.settings.colorTheme)}</span>
        <div className="gs-theme-switcher" role="list" aria-label={tt(i18n.experience.settings.colorTheme)}>
          {surfaceThemeOptions.map((option) => (
            <button
              type="button"
              key={option.id}
              className={preferences.theme === option.id ? 'is-active' : ''}
              onClick={() => onThemeChange(option.id)}
            >
              <strong>{tt(option.label)}</strong>
              <span>{tt(option.description)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="gs-settings-group">
        <span className="gs-settings-group__label">{tt(i18n.experience.settings.density)}</span>
        <div className="gs-toggle-row">
          <button
            type="button"
            className={preferences.density === 'comfortable' ? 'is-active' : ''}
            onClick={() => onDensityChange('comfortable')}
          >
            {tt(i18n.experience.settings.comfortable)}
          </button>
          <button
            type="button"
            className={preferences.density === 'compact' ? 'is-active' : ''}
            onClick={() => onDensityChange('compact')}
          >
            {tt(i18n.experience.settings.compact)}
          </button>
        </div>
      </div>

      <div className="gs-settings-group">
        <span className="gs-settings-group__label">{tt(i18n.experience.settings.behavior)}</span>
        <div className="gs-toggle-stack">
          <label className="gs-check-row">
            <input
              type="checkbox"
              checked={preferences.autoSharePreview}
              onChange={(event) => onAutoSharePreviewChange(event.target.checked)}
            />
            <span>{tt(i18n.experience.settings.autoRefreshSharePreviews)}</span>
          </label>
          <label className="gs-check-row">
            <input
              type="checkbox"
              checked={preferences.coachTips}
              onChange={(event) => onCoachTipsChange(event.target.checked)}
            />
            <span>{tt(i18n.experience.settings.keepGuideTipsExpanded)}</span>
          </label>
        </div>
      </div>
    </>
  )
}
