import type { SurfaceTheme } from '../surfaceThemes.js'
import { surfaceThemeOptions } from '../surfaceThemes.js'

export interface SurfaceExperiencePreferences {
  theme: SurfaceTheme
  density: 'comfortable' | 'compact'
  autoSharePreview: boolean
  coachTips: boolean
}

export interface ExperiencePanelProps {
  preferences: SurfaceExperiencePreferences
  showGuide: boolean
  showSettings: boolean
  shortcutNotice: string | null
  onToggleGuide: () => void
  onToggleSettings: () => void
  onThemeChange: (theme: SurfaceTheme) => void
  onDensityChange: (density: SurfaceExperiencePreferences['density']) => void
  onAutoSharePreviewChange: (enabled: boolean) => void
  onCoachTipsChange: (enabled: boolean) => void
  onJumpToShare: () => void
  onJumpToCaseStudy: () => void
}

const shortcutRows = [
  { keyLabel: '?', action: 'Open guide and shortcuts' },
  { keyLabel: 'T', action: 'Cycle color theme' },
  { keyLabel: 'G', action: 'Toggle heatmap' },
  { keyLabel: 'L / R', action: 'Jump between live and replay' },
  { keyLabel: '1 / 6 / 2', action: 'Switch replay window to 1h, 6h, or 24h' },
  { keyLabel: 'S', action: 'Scroll to the share panel' },
]

const guideTips = [
  'Lead with the office stage, then use the analytics cards to explain momentum, confidence, and baseline comparisons.',
  'Keep social cards short: one headline, one proof metric, and one timestamp anchor converts better than a dense status dump.',
  'Use the case study layer while reviewing privacy boundaries so visitors see the transformation instead of reading an abstract policy.',
]

export function ExperiencePanel({
  preferences,
  showGuide,
  showSettings,
  shortcutNotice,
  onToggleGuide,
  onToggleSettings,
  onThemeChange,
  onDensityChange,
  onAutoSharePreviewChange,
  onCoachTipsChange,
  onJumpToShare,
  onJumpToCaseStudy,
}: ExperiencePanelProps) {
  return (
    <section className="gs-experience-panel" aria-label="Experience controls and guide">
      <div className="gs-experience-panel__head">
        <div>
          <span className="gs-section-kicker">Experience Layer</span>
          <h2>Guide the story, expose shortcuts, and let the page adapt to the viewer.</h2>
        </div>

        <div className="gs-experience-panel__actions">
          <button type="button" onClick={onToggleGuide}>
            {showGuide ? 'Hide guide' : 'Show guide'}
          </button>
          <button type="button" onClick={onToggleSettings}>
            {showSettings ? 'Hide settings' : 'Show settings'}
          </button>
          <button type="button" onClick={onJumpToShare}>Jump to share</button>
          <button type="button" onClick={onJumpToCaseStudy}>Jump to case study</button>
        </div>
      </div>

      {shortcutNotice ? <div className="gs-experience-panel__notice">{shortcutNotice}</div> : null}

      {(showGuide || showSettings) ? (
        <div className="gs-experience-panel__grid">
          {showGuide ? (
            <>
              <article className="gs-experience-card">
                <div className="gs-side-card__eyebrow">Guide tips</div>
                <h3>Make the product narrative easier to follow.</h3>
                <ul className="gs-experience-list">
                  {guideTips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </article>

              <article className="gs-experience-card">
                <div className="gs-side-card__eyebrow">Keyboard shortcuts</div>
                <h3>Fast controls for demos and reviews.</h3>
                <div className="gs-shortcut-list">
                  {shortcutRows.map((row) => (
                    <div className="gs-shortcut-row" key={row.keyLabel}>
                      <span>{row.keyLabel}</span>
                      <strong>{row.action}</strong>
                    </div>
                  ))}
                </div>
              </article>
            </>
          ) : null}

          {showSettings ? (
            <article className="gs-experience-card gs-experience-card--settings">
              <div className="gs-side-card__eyebrow">Personalization</div>
              <h3>Tune the surface for your preferred review mode.</h3>

              <div className="gs-settings-group">
                <span className="gs-settings-group__label">Color theme</span>
                <div className="gs-theme-switcher" role="list" aria-label="Color themes">
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
                <span className="gs-settings-group__label">Density</span>
                <div className="gs-toggle-row">
                  <button
                    type="button"
                    className={preferences.density === 'comfortable' ? 'is-active' : ''}
                    onClick={() => onDensityChange('comfortable')}
                  >
                    Comfortable
                  </button>
                  <button
                    type="button"
                    className={preferences.density === 'compact' ? 'is-active' : ''}
                    onClick={() => onDensityChange('compact')}
                  >
                    Compact
                  </button>
                </div>
              </div>

              <div className="gs-settings-group">
                <span className="gs-settings-group__label">Behavior</span>
                <div className="gs-toggle-stack">
                  <label className="gs-check-row">
                    <input
                      type="checkbox"
                      checked={preferences.autoSharePreview}
                      onChange={(event) => onAutoSharePreviewChange(event.target.checked)}
                    />
                    <span>Auto-refresh share previews when the frame changes</span>
                  </label>
                  <label className="gs-check-row">
                    <input
                      type="checkbox"
                      checked={preferences.coachTips}
                      onChange={(event) => onCoachTipsChange(event.target.checked)}
                    />
                    <span>Keep guide tips expanded by default</span>
                  </label>
                </div>
              </div>
            </article>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
