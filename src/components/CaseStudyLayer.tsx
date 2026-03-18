import { useEffect, useState } from 'react'
import type { DisplaySession } from '../publicDisplay.js'
import { getPublicAgentLabel, getSignalWindowLabel, getStatusLabel, getZoneLabel } from '../publicDisplay.js'
import { i18n } from '../content/i18n.js'
import { useT } from '../content/locale.js'

type CaseStudyView = 'raw' | 'public' | 'surface'

const rawExample = {
  sessionKey: 'session_7f91ce5a',
  user: 'acme-vip@example.com',
  prompt: 'Draft a pricing response and mention the approved discount ladder.',
  transcript: '...full transcript hidden...',
  toolArgs: {
    file: '/Users/internal/acme/pricing.md',
    command: 'gh secret set INTERNAL_API_TOKEN',
  },
  model: 'gpt-5-codex-2026-03-12',
}

export interface CaseStudyLayerProps {
  exampleSession: DisplaySession | null
}

export function CaseStudyLayer({ exampleSession }: CaseStudyLayerProps) {
  const tt = useT()
  const [activeView, setActiveView] = useState<CaseStudyView>('public')
  const [activeStep, setActiveStep] = useState(1)
  const [activeField, setActiveField] = useState(0)
  const [openFaqIndex, setOpenFaqIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(true)

  const faqItems = [
    {
      question: tt(i18n.caseStudy.faq.hideSessionKeys.question),
      answer: tt(i18n.caseStudy.faq.hideSessionKeys.answer),
    },
    {
      question: tt(i18n.caseStudy.faq.timestampedLinks.question),
      answer: tt(i18n.caseStudy.faq.timestampedLinks.answer),
    },
    {
      question: tt(i18n.caseStudy.faq.sanitizationVisualized.question),
      answer: tt(i18n.caseStudy.faq.sanitizationVisualized.answer),
    },
  ]

  const flowSteps: Array<{ id: CaseStudyView; label: string; detail: string }> = [
    {
      id: 'raw',
      label: `1. ${tt(i18n.caseStudy.flow.rawGateway)}`,
      detail: tt(i18n.caseStudy.flow.rawDetail),
    },
    {
      id: 'public',
      label: `2. ${tt(i18n.caseStudy.flow.publicSnapshot)}`,
      detail: tt(i18n.caseStudy.flow.publicDetail),
    },
    {
      id: 'surface',
      label: `3. ${tt(i18n.caseStudy.flow.productSurface)}`,
      detail: tt(i18n.caseStudy.flow.surfaceDetail),
    },
  ]

  useEffect(() => {
    if (!isAnimating) return undefined

    const intervalId = window.setInterval(() => {
      setActiveStep((previous) => {
        const nextStep = (previous + 1) % flowSteps.length
        setActiveView(flowSteps[nextStep].id)
        return nextStep
      })
    }, 2200)

    return () => window.clearInterval(intervalId)
  }, [isAnimating, flowSteps.length])

  const publicExample = {
    publicId: exampleSession?.publicId || 'pub_demo_214',
    agentId: getPublicAgentLabel(exampleSession?.agentId),
    zone: getZoneLabel(exampleSession?.zone || 'code-studio'),
    modelFamily: exampleSession?.modelFamily || 'GPT',
    status: getStatusLabel(exampleSession?.status || 'running'),
    activityWindow: getSignalWindowLabel(exampleSession?.signalWindow || 'live'),
  }

  const fieldCards = [
    {
      title: tt(i18n.caseStudy.fields.identity),
      raw: rawExample.user,
      public: tt(i18n.caseStudy.fields.hidden),
      surface: publicExample.agentId,
      note: tt(i18n.caseStudy.fields.identityNote),
    },
    {
      title: tt(i18n.caseStudy.fields.promptContext),
      raw: rawExample.prompt,
      public: tt(i18n.caseStudy.fields.promptHidden),
      surface: tt(i18n.caseStudy.fields.activityWindowOnly),
      note: tt(i18n.caseStudy.fields.promptContextNote),
    },
    {
      title: tt(i18n.caseStudy.fields.toolArguments),
      raw: rawExample.toolArgs.command,
      public: tt(i18n.caseStudy.fields.toolArgsHidden),
      surface: tt(i18n.caseStudy.fields.notRendered),
      note: tt(i18n.caseStudy.fields.toolArgumentsNote),
    },
    {
      title: tt(i18n.caseStudy.fields.modelDetail),
      raw: rawExample.model,
      public: publicExample.modelFamily,
      surface: publicExample.modelFamily,
      note: tt(i18n.caseStudy.fields.modelDetailNote),
    },
  ]

  const selectedField = fieldCards[activeField] || fieldCards[0]

  const handleSelectView = (view: CaseStudyView, index: number) => {
    setActiveView(view)
    setActiveStep(index)
    setIsAnimating(false)
  }

  const stepProgress = `${((activeStep + 1) / flowSteps.length) * 100}%`

  return (
    <section className="gs-case-study" id="case-study-layer">
      <div className="gs-case-study__head">
        <span className="gs-section-kicker">{tt(i18n.caseStudy.eyebrow)}</span>
        <h2>{tt(i18n.caseStudy.title)}</h2>
        <p>{tt(i18n.caseStudy.description)}</p>
      </div>

      <div className="gs-case-study__layout">
        <article className="gs-case-study__example">
          <div className="gs-case-study__tabs" role="tablist" aria-label={tt(i18n.caseStudy.eyebrow)}>
            {flowSteps.map((step, index) => (
              <button
                type="button"
                key={step.id}
                className={activeView === step.id ? 'is-active' : ''}
                onClick={() => handleSelectView(step.id, index)}
              >
                {step.label}
              </button>
            ))}
          </div>

          <div className="gs-case-study__timeline">
            <div className="gs-case-study__timeline-track">
              <div className="gs-case-study__timeline-progress" style={{ width: stepProgress }} />
            </div>
            <div className="gs-case-study__timeline-meta">
              <span>{flowSteps[activeStep].detail}</span>
              <button type="button" onClick={() => setIsAnimating((previous) => !previous)}>
                {isAnimating ? tt(i18n.caseStudy.flow.pauseAnimation) : tt(i18n.caseStudy.flow.playAnimation)}
              </button>
            </div>
          </div>

          {activeView === 'raw' ? (
            <div className="gs-case-study__panel">
              <div className="gs-case-study__label">{tt(i18n.caseStudy.panels.beforeSanitization)}</div>
              <pre>{JSON.stringify(rawExample, null, 2)}</pre>
            </div>
          ) : null}

          {activeView === 'public' ? (
            <div className="gs-case-study__panel">
              <div className="gs-case-study__label">{tt(i18n.caseStudy.panels.afterSanitization)}</div>
              <pre>{JSON.stringify(publicExample, null, 2)}</pre>
              <div className="gs-case-study__mask-grid">
                <span className="is-hidden">{tt(i18n.caseStudy.fields.promptHidden)}</span>
                <span className="is-hidden">{tt(i18n.caseStudy.fields.transcriptHidden)}</span>
                <span className="is-hidden">{tt(i18n.caseStudy.fields.toolArgsHidden)}</span>
                <span className="is-hidden">{tt(i18n.caseStudy.fields.userIdentityHidden)}</span>
                <span className="is-visible">{tt(i18n.caseStudy.fields.publicAliasPreserved)}</span>
                <span className="is-visible">{tt(i18n.caseStudy.fields.modelFamilyPreserved)}</span>
              </div>
            </div>
          ) : null}

          {activeView === 'surface' ? (
            <div className="gs-case-study__panel">
              <div className="gs-case-study__label">{tt(i18n.caseStudy.panels.renderedProductSurface)}</div>
              <div className="gs-case-study__surface-card">
                <strong>{publicExample.agentId}</strong>
                <span>{publicExample.zone}</span>
                <span>{publicExample.modelFamily}</span>
                <span>{publicExample.status}</span>
                <span>{publicExample.activityWindow}</span>
              </div>
              <p>{tt(i18n.caseStudy.panels.surfaceCardExplanation)}</p>
            </div>
          ) : null}

          <div className="gs-case-study__interactive">
            <div className="gs-case-study__label">{tt(i18n.caseStudy.cards.interactive.eyebrow)}</div>
            <div className="gs-case-study__field-grid">
              {fieldCards.map((field, index) => (
                <button
                  type="button"
                  key={field.title}
                  className={activeField === index ? 'is-active' : ''}
                  onClick={() => setActiveField(index)}
                >
                  <span>{field.title}</span>
                  <strong>{field[activeView]}</strong>
                </button>
              ))}
            </div>

            <div className="gs-case-study__field-detail">
              <span>{selectedField.title}</span>
              <p>{selectedField.note}</p>
            </div>
          </div>
        </article>

        <div className="gs-case-study__stack">
          <div className="gs-case-grid">
            <article className="gs-case-card">
              <div className="gs-case-card__eyebrow">{tt(i18n.caseStudy.cards.interactive.eyebrow)}</div>
              <h3>{tt(i18n.caseStudy.cards.interactive.title)}</h3>
              <p>{tt(i18n.caseStudy.cards.interactive.body)}</p>
            </article>
            <article className="gs-case-card">
              <div className="gs-case-card__eyebrow">{tt(i18n.caseStudy.cards.animation.eyebrow)}</div>
              <h3>{tt(i18n.caseStudy.cards.animation.title)}</h3>
              <p>{tt(i18n.caseStudy.cards.animation.body)}</p>
            </article>
            <article className="gs-case-card">
              <div className="gs-case-card__eyebrow">{tt(i18n.caseStudy.cards.faq.eyebrow)}</div>
              <h3>{tt(i18n.caseStudy.cards.faq.title)}</h3>
              <p>{tt(i18n.caseStudy.cards.faq.body)}</p>
            </article>
          </div>

          <div className="gs-faq">
            {faqItems.map((item, index) => {
              const isOpen = openFaqIndex === index
              return (
                <article className={`gs-faq__item ${isOpen ? 'is-open' : ''}`} key={item.question}>
                  <button
                    type="button"
                    className="gs-faq__trigger"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaqIndex((previous) => (previous === index ? -1 : index))}
                  >
                    <span>{item.question}</span>
                    <strong>{isOpen ? '−' : '+'}</strong>
                  </button>
                  {isOpen ? <p>{item.answer}</p> : null}
                </article>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
