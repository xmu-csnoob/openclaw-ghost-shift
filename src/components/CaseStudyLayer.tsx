import { useEffect, useState } from 'react'
import type { DisplaySession } from '../publicDisplay.js'
import { getPublicAgentLabel, getZoneLabel } from '../publicDisplay.js'

type CaseStudyView = 'raw' | 'public' | 'surface'

const faqItems = [
  {
    question: 'Why does Ghost Shift hide session keys and raw model names?',
    answer:
      'The public surface tells a product story, not an operator story. Stable aliases and model families preserve continuity while removing handles that could leak internals or confuse casual viewers.',
  },
  {
    question: 'Why are the timeline and share links timestamped?',
    answer:
      'Timestamped links keep review conversations anchored to a single frame. That matters in async design reviews because everyone lands on the same evidence instead of a moving live edge.',
  },
  {
    question: 'Why is the sanitization flow visualized in the product surface?',
    answer:
      'Privacy boundaries are easier to trust when people can inspect them. The case study layer shows what gets removed, what survives, and why the resulting view is safe to share.',
  },
]

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

const flowSteps: Array<{ id: CaseStudyView; label: string; detail: string }> = [
  {
    id: 'raw',
    label: '1. Raw gateway',
    detail: 'Identity, prompts, and tool arguments still exist here.',
  },
  {
    id: 'public',
    label: '2. Public snapshot',
    detail: 'Sensitive fields are stripped and only public-safe metadata remains.',
  },
  {
    id: 'surface',
    label: '3. Product surface',
    detail: 'The browser renders from the reduced contract only.',
  },
]

export interface CaseStudyLayerProps {
  exampleSession: DisplaySession | null
}

export function CaseStudyLayer({ exampleSession }: CaseStudyLayerProps) {
  const [activeView, setActiveView] = useState<CaseStudyView>('public')
  const [activeStep, setActiveStep] = useState(1)
  const [activeField, setActiveField] = useState(0)
  const [openFaqIndex, setOpenFaqIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(true)

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
  }, [isAnimating])

  const publicExample = {
    publicId: exampleSession?.publicId || 'pub_demo_214',
    agentId: getPublicAgentLabel(exampleSession?.agentId),
    zone: getZoneLabel(exampleSession?.zone || 'code-studio'),
    modelFamily: exampleSession?.modelFamily || 'GPT',
    status: exampleSession?.status || 'running',
    activityWindow: exampleSession?.signalWindow || 'live',
  }

  const fieldCards = [
    {
      title: 'Identity',
      raw: rawExample.user,
      public: 'hidden',
      surface: publicExample.agentId,
      note: 'Personal identifiers are removed before the browser receives the payload.',
    },
    {
      title: 'Prompt context',
      raw: rawExample.prompt,
      public: 'prompt hidden',
      surface: 'activity window only',
      note: 'Prompt text becomes coarse activity metadata instead of display content.',
    },
    {
      title: 'Tool arguments',
      raw: rawExample.toolArgs.command,
      public: 'tool args hidden',
      surface: 'not rendered',
      note: 'Operational commands never enter the public contract.',
    },
    {
      title: 'Model detail',
      raw: rawExample.model,
      public: publicExample.modelFamily,
      surface: publicExample.modelFamily,
      note: 'Model families stay visible because they explain capability without exposing raw deployment strings.',
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
        <span className="gs-section-kicker">Case Study Layer</span>
        <h2>Show the transformation, animate the privacy boundary, and answer trust questions in place.</h2>
        <p>
          This layer turns the sanitization contract into a guided demo: click through each data boundary, watch the
          flow animate, and expand the FAQ without leaving the product surface.
        </p>
      </div>

      <div className="gs-case-study__layout">
        <article className="gs-case-study__example">
          <div className="gs-case-study__tabs" role="tablist" aria-label="Case study examples">
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
                {isAnimating ? 'Pause animation' : 'Play animation'}
              </button>
            </div>
          </div>

          {activeView === 'raw' ? (
            <div className="gs-case-study__panel">
              <div className="gs-case-study__label">Before sanitization</div>
              <pre>{JSON.stringify(rawExample, null, 2)}</pre>
            </div>
          ) : null}

          {activeView === 'public' ? (
            <div className="gs-case-study__panel">
              <div className="gs-case-study__label">After sanitization</div>
              <pre>{JSON.stringify(publicExample, null, 2)}</pre>
              <div className="gs-case-study__mask-grid">
                <span className="is-hidden">prompt hidden</span>
                <span className="is-hidden">transcript hidden</span>
                <span className="is-hidden">tool args hidden</span>
                <span className="is-hidden">user identity hidden</span>
                <span className="is-visible">public alias preserved</span>
                <span className="is-visible">model family preserved</span>
              </div>
            </div>
          ) : null}

          {activeView === 'surface' ? (
            <div className="gs-case-study__panel">
              <div className="gs-case-study__label">Rendered product surface</div>
              <div className="gs-case-study__surface-card">
                <strong>{publicExample.agentId}</strong>
                <span>{publicExample.zone}</span>
                <span>{publicExample.modelFamily}</span>
                <span>{publicExample.status}</span>
                <span>{publicExample.activityWindow}</span>
              </div>
              <p>
                The office scene, analytics cards, and social share card all render from this narrower contract instead
                of from the raw gateway payload.
              </p>
            </div>
          ) : null}

          <div className="gs-case-study__interactive">
            <div className="gs-case-study__label">Interactive example</div>
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
              <div className="gs-case-card__eyebrow">Interactive example</div>
              <h3>Inspect one rule at a time.</h3>
              <p>Each field card updates with the current stage so visitors can compare raw, public, and rendered states.</p>
            </article>
            <article className="gs-case-card">
              <div className="gs-case-card__eyebrow">Animation demo</div>
              <h3>Play the privacy flow during live demos.</h3>
              <p>The animated track keeps the sanitization story moving when you are presenting the product in person.</p>
            </article>
            <article className="gs-case-card">
              <div className="gs-case-card__eyebrow">FAQ accordion</div>
              <h3>Collapse detail until the viewer asks for it.</h3>
              <p>Trust questions stay nearby, but the explanation layer avoids overwhelming the primary narrative.</p>
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
