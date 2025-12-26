import { describe, expect, it } from "vitest"
import { applyContrastAndThreshold, estimateThreshold, withRetry } from "./ocr-utils"

describe("ocr-utils", () => {
  it("applies grayscale thresholding to improve contrast", () => {
    const pixels = new Uint8ClampedArray([
      10, 10, 10, 255, // dark pixel
      240, 240, 240, 255, // bright pixel
    ])

    const threshold = estimateThreshold(pixels)
    const processed = applyContrastAndThreshold(pixels, 1, threshold)

    expect(Array.from(processed.slice(0, 4))).toEqual([0, 0, 0, 255])
    expect(Array.from(processed.slice(4, 8))).toEqual([255, 255, 255, 255])
  })

  it("retries failed operations before succeeding", async () => {
    let attempts = 0
    const result = await withRetry(
      async () => {
        attempts++
        if (attempts === 1) {
          throw new Error("first failure")
        }
        return "ok"
      },
      { retries: 2, delayMs: 1 },
    )

    expect(result).toBe("ok")
    expect(attempts).toBe(2)
  })

  it("surfaces the last error after exhausting retries", async () => {
    await expect(
      withRetry(
        () => {
          throw new Error("persistent failure")
        },
        { retries: 1, delayMs: 1 },
      ),
    ).rejects.toThrow("persistent failure")
  })
})
