import { useSyncExternalStore } from 'react'

export type Locale = 'zh' | 'en'

export interface LocalizedText {
  zh: string
  en: string
}

export type TranslatableText = string | LocalizedText
export type TranslationValues = Record<string, number | string>

const STORAGE_KEY = 'ghostshift-locale'
const DEFAULT_LOCALE: Locale = 'zh'
const subscribers = new Set<() => void>()

function canUseBrowserApis(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

function resolveStoredLocale(): Locale | null {
  if (!canUseBrowserApis()) {
    return null
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'zh' || stored === 'en') {
      return stored
    }
  } catch {
    // Ignore storage access errors and continue to browser language detection.
  }

  return null
}

function notifySubscribers(): void {
  subscribers.forEach((callback) => callback())
}

function applyDocumentLocale(locale: Locale): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale
  }
}

function getInitialLocale(): Locale {
  const stored = resolveStoredLocale()
  if (stored) {
    return stored
  }

  if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('zh')) {
    return 'zh'
  }

  return DEFAULT_LOCALE
}

let currentLocale: Locale = getInitialLocale()
let storageListenerAttached = false

function ensureStorageListener(): void {
  if (!canUseBrowserApis() || storageListenerAttached) {
    return
  }

  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return
    if (event.newValue !== 'zh' && event.newValue !== 'en') return

    currentLocale = event.newValue
    applyDocumentLocale(currentLocale)
    notifySubscribers()
  })

  storageListenerAttached = true
}

applyDocumentLocale(currentLocale)
ensureStorageListener()

export function getLocale(): Locale {
  return currentLocale
}

export function getIntlLocale(locale: Locale = currentLocale): string {
  return locale === 'zh' ? 'zh-CN' : 'en-US'
}

export function setLocale(locale: Locale): void {
  const changed = currentLocale !== locale
  currentLocale = locale
  applyDocumentLocale(locale)

  if (canUseBrowserApis()) {
    try {
      localStorage.setItem(STORAGE_KEY, locale)
    } catch {
      // Ignore persistence failures and keep the in-memory locale.
    }
  }

  if (changed) {
    notifySubscribers()
  }
}

export function subscribeToLocale(callback: () => void): () => void {
  ensureStorageListener()
  subscribers.add(callback)
  return () => subscribers.delete(callback)
}

function applyValues(template: string, values?: TranslationValues): string {
  if (!values) {
    return template
  }

  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key]
    return value === undefined ? match : String(value)
  })
}

export function t(text: TranslatableText, values?: TranslationValues): string {
  const resolved = typeof text === 'string'
    ? text
    : text[currentLocale] || text.zh || text.en

  return applyValues(resolved, values)
}

export function useLocale(): Locale {
  return useSyncExternalStore(subscribeToLocale, getLocale, getLocale)
}

export function useT(): (text: TranslatableText, values?: TranslationValues) => string {
  useLocale()
  return t
}
