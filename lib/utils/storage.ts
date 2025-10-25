/**
 * Local storage utilities for app settings
 */

const STORAGE_KEYS = {
  DEEPSEEK_API_KEY: "deepseek_api_key",
  OCR_SETTINGS: "ocr_settings",
} as const

export interface OCRSettings {
  enhanceImage: boolean
  language: string
  preserveLayout: boolean
}

const DEFAULT_OCR_SETTINGS: OCRSettings = {
  enhanceImage: true,
  language: "auto",
  preserveLayout: true,
}

/**
 * Get DeepSeek API key from local storage
 */
export function getDeepSeekApiKey(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(STORAGE_KEYS.DEEPSEEK_API_KEY)
}

/**
 * Set DeepSeek API key in local storage
 */
export function setDeepSeekApiKey(apiKey: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEYS.DEEPSEEK_API_KEY, apiKey)
}

/**
 * Remove DeepSeek API key from local storage
 */
export function removeDeepSeekApiKey(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(STORAGE_KEYS.DEEPSEEK_API_KEY)
}

/**
 * Get OCR settings from local storage
 */
export function getOCRSettings(): OCRSettings {
  if (typeof window === "undefined") return DEFAULT_OCR_SETTINGS

  const stored = localStorage.getItem(STORAGE_KEYS.OCR_SETTINGS)
  if (!stored) return DEFAULT_OCR_SETTINGS

  try {
    return { ...DEFAULT_OCR_SETTINGS, ...JSON.parse(stored) }
  } catch {
    return DEFAULT_OCR_SETTINGS
  }
}

/**
 * Set OCR settings in local storage
 */
export function setOCRSettings(settings: Partial<OCRSettings>): void {
  if (typeof window === "undefined") return

  const current = getOCRSettings()
  const updated = { ...current, ...settings }
  localStorage.setItem(STORAGE_KEYS.OCR_SETTINGS, JSON.stringify(updated))
}
