import type { SurfaceTheme } from '../surfaceThemes.js'
import { i18n } from '../content/i18n.js'

export interface SurfaceExperiencePreferences {
  theme: SurfaceTheme
  density: 'comfortable' | 'compact'
  autoSharePreview: boolean
  coachTips: boolean
}

export interface ExperiencePanelProps {
  showGuide: boolean
  shortcutNotice: string | null
  onToggleGuide: () => void
  onJumpToShare: () => void
  onOpenHelp: () => void
}

const shortcutRows = i18n.experience.shortcuts.items

const guideTips = i18n.experience.guide.tips

export function ExperiencePanel({
  showGuide,
  shortcutNotice,
  onToggleGuide,
  onJumpToShare,
  onOpenHelp,
}: ExperiencePanelProps) {
  return (
    <section className="gs-experience-panel" aria-label="Experience controls and guide">
      <div className="gs-experience-panel__head">
        <div>
          <span className="gs-section-kicker">{i18n.panels.experience}</span>
          <h2>{i18n.experience.title}</h2>
        </div>

        <div className="gs-experience-panel__actions">
          <button type="button" onClick={onToggleGuide}>
            {showGuide ? i18n.experience.actions.hideGuide : i18n.experience.actions.showGuide}
          </button>
          <button type="button" onClick={onJumpToShare}>{i18n.experience.actions.jumpToShare}</button>
          <button type="button" className="gs-help-button" onClick={onOpenHelp} aria-label="Open help and case study">
            ?
          </button>
        </div>
      </div>

      {shortcutNotice ? <div className="gs-experience-panel__notice">{shortcutNotice}</div> : null}

      {showGuide ? (
        <div className="gs-experience-panel__grid">
          <article className="gs-experience-card">
            <div className="gs-side-card__eyebrow">{i18n.experience.guide.eyebrow}</div>
            <h3>{i18n.experience.guide.title}</h3>
            <ul className="gs-experience-list">
              {guideTips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </article>

          <article className="gs-experience-card">
            <div className="gs-side-card__eyebrow">{i18n.experience.shortcuts.eyebrow}</div>
            <h3>{i18n.experience.shortcuts.title}</h3>
            <div className="gs-shortcut-list">
              {shortcutRows.map((row) => (
                <div className="gs-shortcut-row" key={row.key}>
                  <span>{row.key}</span>
                  <strong>{row.action}</strong>
                </div>
              ))}
            </div>
          </article>
        </div>
      ) : null}
    </section>
  )
}
