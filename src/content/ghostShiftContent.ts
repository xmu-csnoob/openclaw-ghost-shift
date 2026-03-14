import { SNAPSHOT_REFRESH_MS } from '../surfaceConfig.js'

export interface SurfaceCardCopy {
  eyebrow: string
  title: string
  body: string
  note: string
  featured?: boolean
}

export interface CaseStudyCardCopy {
  title: string
  body: string
}

export const heroPills = [
  'Privacy-safe public telemetry',
  'Embeddable portfolio card',
  'Mobile-friendly office demo',
]

export const surfaceCards: SurfaceCardCopy[] = [
  {
    eyebrow: 'Featured surface',
    title: 'Public office demo',
    body:
      'A live pixel office that turns active agent work into something visitors can read in seconds: room occupancy, signal strength, activity bands, and public-facing cadence.',
    note: 'Lead with the live office, not an empty dashboard shell.',
    featured: true,
  },
  {
    eyebrow: 'Portfolio embed',
    title: 'Summary card',
    body:
      'A compact card built for `me.wenfei4288.com`: headline, live status, visible counts, top wing, and refresh cadence in a format that survives tight layouts.',
    note: 'Use it as the teaser surface before sending readers into the full office.',
  },
  {
    eyebrow: 'Boundary layer',
    title: 'Case study framing',
    body:
      'A dedicated explanation layer that tells visitors what the demo is actually rendering, what stays hidden, and why the public surface can be shared safely.',
    note: 'The privacy boundary is part of the product story, not a footnote.',
  },
]

export const caseStudyCards: CaseStudyCardCopy[] = [
  {
    title: 'What the demo is',
    body:
      'Ghost Shift reads a privacy-safe public snapshot and renders it as a live office. Visitors see room-level activity, public aliases, coarse roles, model families, and behavior bands instead of raw backend state.',
  },
  {
    title: 'What stays hidden',
    body:
      'Prompts, transcripts, approvals, tool arguments, exact token counts, device identity, and internal session keys stay out of the product surface. The office is designed to expose narrative signal without exposing operating detail.',
  },
  {
    title: 'Update cadence',
    body: `The public surface refreshes every ${SNAPSHOT_REFRESH_MS / 1000} seconds. That is fast enough to feel live in a portfolio context, but coarse enough to avoid turning the page into an operator console.`,
  },
]

export const demoSidebarNotes = [
  'Visitors can understand the product at a glance because the office scene carries the explanation work.',
  'The public office remains useful on mobile: the demo stays readable, while dense telemetry folds into supporting cards below.',
  'Summary card and case study copy now mirror the same privacy contract as the live surface.',
]

export const documentationPoints = [
  'Embed the summary card under a dedicated iframe path so the portfolio site can treat it as a clean, reusable surface.',
  'Use the case study layer to explain that the office is a public rendering, not a gateway mirror.',
  'Keep the office demo visually dominant in the portfolio so readers immediately see the product working.',
]
