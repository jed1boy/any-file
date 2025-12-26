export interface RetryOptions {
  retries: number
  delayMs: number
}

const clampChannel = (value: number): number => Math.min(255, Math.max(0, value))

export function estimateThreshold(data: Uint8ClampedArray): number {
  if (data.length === 0) return 128

  let sum = 0
  let count = 0

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    sum += gray
    count++
  }

  return count === 0 ? 128 : sum / count
}

export function applyContrastAndThreshold(
  data: Uint8ClampedArray,
  contrast = 1.2,
  threshold = estimateThreshold(data),
): Uint8ClampedArray {
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast))
  const output = new Uint8ClampedArray(data.length)

  for (let i = 0; i < data.length; i += 4) {
    const contrastedRed = clampChannel(factor * (data[i] - 128) + 128)
    const contrastedGreen = clampChannel(factor * (data[i + 1] - 128) + 128)
    const contrastedBlue = clampChannel(factor * (data[i + 2] - 128) + 128)

    const gray = 0.299 * contrastedRed + 0.587 * contrastedGreen + 0.114 * contrastedBlue
    const value = gray >= threshold ? 255 : 0

    output[i] = value
    output[i + 1] = value
    output[i + 2] = value
    output[i + 3] = data[i + 3]
  }

  return output
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
  onRetry?: (error: unknown, attempt: number) => void,
): Promise<T> {
  let attempt = 0
  let lastError: unknown

  while (attempt <= options.retries) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (attempt === options.retries) {
        break
      }
      onRetry?.(error, attempt + 1)
      await new Promise((resolve) => setTimeout(resolve, options.delayMs * (attempt + 1)))
    }
    attempt++
  }

  throw lastError instanceof Error ? lastError : new Error("Operation failed after retries")
}
