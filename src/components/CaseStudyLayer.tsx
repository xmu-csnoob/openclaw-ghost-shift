import { useState } from 'react'
import type { DisplaySession } from '../publicDisplay.js'
import { getPublicAgentLabel, getZoneLabel } from '../publicDisplay.js'

type CaseStudyView = 'raw' | 'public' | 'surface'

const faqItems = [
  {
    question: 'Why does Ghost Shift hide session keys and raw model names?',
    answer:
      'The portfolio surface is meant to tell the public story, not mirror the operator console. Stable public aliases and model families preserve continuity without exposing internal handles.',
  },
  {
    question: 'Why are the timeline and share links timestamped?',
    answer:
      'Timestamped links let people land on the same replay frame you are discussing, which makes product reviews and async sharing much easier.',
  },
  {
    question: 'Why are some yesterday bars marked as partial?',
    answer:
      'The comparison chart only uses retained public history. If the server only keeps the last 24 hours, the yesterday side may be incomplete until retention is extended.',
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

export interface CaseStudyLayerProps {
  exampleSession: DisplaySession | null
}

export function CaseStudyLayer({ exampleSession }: CaseStudyLayerProps) {
  const [activeView, setActiveView] = useState<CaseStudyView>('public')

  const publicExample = {
    publicId: exampleSession?.publicId || 'pub_demo_214',
    agentId: getPublicAgentLabel(exampleSession?.agentId),
    zone: getZoneLabel(exampleSession?.zone || 'code-studio'),
    modelFamily: exampleSession?.modelFamily || 'GPT',
    status: exampleSession?.status || 'running',
    activityWindow: exampleSession?.signalWindow || 'live',
  }

  return (
    <section className="gs-case-study" id="case-study-layer">
      <div className="gs-case-study__head">
        <span className="gs-section-kicker">Case Study Layer</span>
        <h2>Show the data boundary instead of asking viewers to infer it.</h2>
        <p>
          This layer makes the privacy contract explicit: what enters Ghost Shift, what gets stripped, and what the
          public surface finally renders.
        </p>
      </div>

      <div className="gs-case-study__layout">
        <article className="gs-case-study__example">
          <div className="gs-case-study__tabs" role="tablist" aria-label="Case study examples">
            <button type="button" className={activeView === 'raw' ? 'is-active' : ''} onClick={() => setActiveView('raw')}>
              Raw input
            </button>
            <button type="button" className={activeView === 'public' ? 'is-active' : ''} onClick={() => setActiveView('public')}>
              Public snapshot
            </button>
            <button type="button" className={activeView === 'surface' ? 'is-active' : ''} onClick={() => setActiveView('surface')}>
              Surface output
            </button>
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
                The office scene, summary card, and share card all render from this narrower contract instead of from the
                raw gateway payload.
              </p>
            </div>
          ) : null}
        </article>

        <div className="gs-case-study__stack">
          <div className="gs-case-grid">
            <article className="gs-case-card">
              <div className="gs-case-card__eyebrow">Interactive example</div>
              <h3>Click through the transformation.</h3>
              <p>Raw gateway context becomes a public snapshot, then becomes a portfolio-safe product surface.</p>
            </article>
            <article className="gs-case-card">
              <div className="gs-case-card__eyebrow">Data masking</div>
              <h3>Visible enough to explain, narrow enough to share.</h3>
              <p>Identity, prompts, transcripts, tool arguments, and internal paths are removed before the browser gets the data.</p>
            </article>
            <article className="gs-case-card">
              <div className="gs-case-card__eyebrow">FAQ</div>
              <h3>Answer the trust questions in-place.</h3>
              <p>Use collapsible notes so viewers can inspect the privacy boundary without leaving the product surface.</p>
            </article>
          </div>

          <div className="gs-faq">
            {faqItems.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
