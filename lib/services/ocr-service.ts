/**
 * DeepSeek OCR Service
 * Provides advanced OCR capabilities using DeepSeek API
 * Features: Multi-language support, image pre-processing, text post-processing
 */

import { getDeepSeekApiKey } from "../utils/storage"
import { applyContrastAndThreshold, estimateThreshold, withRetry } from "./ocr-utils"

interface OCRResult {
  text: string
  confidence: number
  language?: string
  blocks?: TextBlock[]
}

interface TextBlock {
  text: string
  bbox: [number, number, number, number]
  confidence: number
}

interface OCROptions {
  language?: string
  enhanceImage?: boolean
  detectOrientation?: boolean
  preserveLayout?: boolean
  retryAttempts?: number
  retryDelayMs?: number
}

type TesseractWorker = import("tesseract.js").Worker

class OCRServiceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = "OCRServiceError"
  }
}

const DEFAULT_RETRY_ATTEMPTS = 2
const DEFAULT_RETRY_DELAY_MS = 300

export class DeepSeekOCRService {
  private apiEndpoint = "https://api.deepseek.com"

  private getApiKey(): string {
    return getDeepSeekApiKey() || ""
  }

  /**
   * Pre-process image for better OCR results
   */
  private async preprocessImage(imageBlob: Blob): Promise<Blob> {
    console.log("[v0] OCR: Starting image pre-processing")

    return new Promise((resolve, reject) => {
      const img = new Image()
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")

      if (!ctx) {
        reject(new OCRServiceError("Unable to initialize canvas context"))
        return
      }

      img.onload = () => {
        try {
          canvas.width = img.width
          canvas.height = img.height

          ctx.drawImage(img, 0, 0)

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const threshold = estimateThreshold(imageData.data)
          const enhancedData = applyContrastAndThreshold(imageData.data, 1.2, threshold)
          const sharpenKernel = [0, -1, 0, -1, 5, -1, 0, -1, 0]
          const sharpened = this.applyConvolution(
            new ImageData(enhancedData, canvas.width, canvas.height),
            sharpenKernel,
            3,
          )

          ctx.putImageData(sharpened, 0, 0)

          canvas.toBlob(
            (blob) => {
              if (blob) {
                console.log("[v0] OCR: Image pre-processing completed")
                resolve(blob)
              } else {
                reject(new OCRServiceError("Failed to create blob from canvas"))
              }
            },
            "image/png",
            0.95,
          )
        } catch (error) {
          reject(new OCRServiceError("Pre-processing failed", error))
        }
      }

      img.onerror = () => reject(new OCRServiceError("Failed to load image"))
      img.src = URL.createObjectURL(imageBlob)
    })
  }

  /**
   * Apply convolution filter to image
   */
  private applyConvolution(imageData: ImageData, kernel: number[], kernelSize: number): ImageData {
    const src = imageData.data
    const sw = imageData.width
    const sh = imageData.height
    const output = new ImageData(sw, sh)
    const dst = output.data
    const half = Math.floor(kernelSize / 2)

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        let r = 0,
          g = 0,
          b = 0

        for (let ky = 0; ky < kernelSize; ky++) {
          for (let kx = 0; kx < kernelSize; kx++) {
            const px = Math.min(sw - 1, Math.max(0, x + kx - half))
            const py = Math.min(sh - 1, Math.max(0, y + ky - half))
            const idx = (py * sw + px) * 4
            const weight = kernel[ky * kernelSize + kx]

            r += src[idx] * weight
            g += src[idx + 1] * weight
            b += src[idx + 2] * weight
          }
        }

        const dstIdx = (y * sw + x) * 4
        dst[dstIdx] = Math.min(255, Math.max(0, r))
        dst[dstIdx + 1] = Math.min(255, Math.max(0, g))
        dst[dstIdx + 2] = Math.min(255, Math.max(0, b))
        dst[dstIdx + 3] = src[dstIdx + 3]
      }
    }

    return output
  }

  /**
   * Post-process extracted text
   */
  private postprocessText(text: string): string {
    console.log("[v0] OCR: Starting text post-processing")

    let processed = text

    // 1. Remove excessive whitespace
    processed = processed.replace(/[ \t]+/g, " ")

    // 2. Fix common OCR errors
    const commonErrors: Record<string, string> = {
      "0": "O", // Zero to letter O in words
      "1": "l", // One to letter l in words
      "5": "S", // Five to letter S in words
      "8": "B", // Eight to letter B in words
    }

    // Apply corrections only in word contexts
    processed = processed.replace(/\b\w+\b/g, (word) => {
      let corrected = word
      for (const [wrong, right] of Object.entries(commonErrors)) {
        // Only replace if it makes sense in context
        if (corrected.includes(wrong) && /[a-zA-Z]/.test(corrected)) {
          corrected = corrected.replace(new RegExp(wrong, "g"), right)
        }
      }
      return corrected
    })

    // 3. Fix line breaks
    processed = processed.replace(/\n{3,}/g, "\n\n") // Max 2 consecutive line breaks

    // 4. Trim each line
    processed = processed
      .split("\n")
      .map((line) => line.trim())
      .join("\n")

    // 5. Remove leading/trailing whitespace
    processed = processed.trim()

    console.log("[v0] OCR: Text post-processing completed")
    return processed
  }

  /**
   * Extract text from image using DeepSeek OCR
   */
  async extractTextFromImage(imageBlob: Blob, options: OCROptions = {}): Promise<OCRResult> {
    console.log("[v0] OCR: Starting text extraction from image")

    try {
      // Pre-process image if requested
      const processedImage = options.enhanceImage ? await this.preprocessImage(imageBlob) : imageBlob

      const apiKey = this.getApiKey()

      // If API key is not available, use fallback Tesseract.js
      if (!apiKey) {
        console.log("[v0] OCR: Using Tesseract.js fallback (no API key)")
        return await this.fallbackOCR(processedImage, options)
      }

      const deepSeekResult = await withRetry(
        () => this.runDeepSeekOCR(processedImage, apiKey, options),
        { retries: options.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS, delayMs: options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS },
        (error, attempt) => console.warn(`[v0] OCR: DeepSeek attempt ${attempt} failed`, error),
      )

      console.log("[v0] OCR: Text extraction completed")

      // Post-process the extracted text
      const processedText = this.postprocessText(deepSeekResult.text || "")

      return {
        text: processedText,
        confidence: deepSeekResult.confidence || 0.95,
        language: deepSeekResult.language,
        blocks: deepSeekResult.blocks,
      }
    } catch (error) {
      console.error("[v0] OCR: Error during extraction:", error)
      // Fallback to Tesseract.js if DeepSeek API fails
      console.log("[v0] OCR: Falling back to Tesseract.js")
      return await this.fallbackOCR(imageBlob, options)
    }
  }

  private async runDeepSeekOCR(image: Blob, apiKey: string, options: OCROptions): Promise<OCRResult> {
    const formData = new FormData()
    formData.append("file", image, "image.png")

    const uploadResponse = await fetch(`${this.apiEndpoint}/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    })

    if (!uploadResponse.ok) {
      throw new OCRServiceError(`Upload failed: ${uploadResponse.statusText}`)
    }

    const { fileId } = await uploadResponse.json()
    console.log("[v0] OCR: Image uploaded, file ID:", fileId)

    const parseResponse = await fetch(`${this.apiEndpoint}/parse/${fileId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        language: options.language || "auto",
        preserve_layout: options.preserveLayout || false,
      }),
    })

    if (!parseResponse.ok) {
      throw new OCRServiceError(`Parse failed: ${parseResponse.statusText}`)
    }

    return await parseResponse.json()
  }

  /**
   * Fallback OCR using Tesseract.js (browser-based)
   */
  private async fallbackOCR(imageBlob: Blob, options: OCROptions): Promise<OCRResult> {
    console.log("[v0] OCR: Using Tesseract.js for text extraction")

    let worker: TesseractWorker | null = null
    let imageUrl: string | null = null

    try {
      // Dynamic import to avoid build issues
      const Tesseract = await import("tesseract.js")

      worker = await Tesseract.createWorker(options.language || "eng")

      imageUrl = URL.createObjectURL(imageBlob)
      const {
        data: { text, confidence },
      } = await worker.recognize(imageUrl)

      // Post-process the extracted text
      const processedText = this.postprocessText(text)

      console.log("[v0] OCR: Tesseract.js extraction completed")

      return {
        text: processedText,
        confidence: confidence / 100,
        language: options.language || "eng",
      }
    } catch (error) {
      console.error("[v0] OCR: Tesseract.js failed:", error)
      throw new OCRServiceError("OCR extraction failed", error)
    } finally {
      if (worker) {
        try {
          await worker.terminate()
        } catch (terminateError) {
          console.warn("[v0] OCR: Failed to terminate Tesseract worker", terminateError)
        }
      }

      if (imageUrl) {
        URL.revokeObjectURL(imageUrl)
      }
    }
  }

  /**
   * Extract text from PDF using DeepSeek OCR
   */
  async extractTextFromPDF(pdfBlob: Blob, options: OCROptions = {}): Promise<OCRResult> {
    console.log("[v0] OCR: Starting text extraction from PDF")

    try {
      // First try to extract text directly from PDF
      const pdfjsLib = await import("pdfjs-dist")
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

      const arrayBuffer = await pdfBlob.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

      let extractedText = ""
      let hasText = false

      // Try to extract text from each page
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items.map((item: any) => item.str).join(" ")

        if (pageText.trim().length > 0) {
          hasText = true
          extractedText += pageText + "\n\n"
        }
      }

      // If PDF has extractable text, use it
      if (hasText) {
        console.log("[v0] OCR: Extracted text directly from PDF")
        const processedText = this.postprocessText(extractedText)
        return {
          text: processedText,
          confidence: 1.0,
        }
      }

      // If no text found, convert PDF pages to images and OCR them
      console.log("[v0] OCR: PDF has no text, converting to images for OCR")

      let ocrText = ""
      for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
        // Limit to 10 pages
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: 2.0 })

        const canvas = document.createElement("canvas")
        const context = canvas.getContext("2d")!
        canvas.width = viewport.width
        canvas.height = viewport.height

        await page.render({ canvasContext: context, viewport }).promise

        // Convert canvas to blob
        const pageBlob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => resolve(blob!), "image/png")
        })

        // OCR the page image
        const result = await this.extractTextFromImage(pageBlob, options)
        ocrText += result.text + "\n\n"
      }

      console.log("[v0] OCR: PDF OCR extraction completed")

      return {
        text: ocrText.trim(),
        confidence: 0.85,
      }
    } catch (error) {
      console.error("[v0] OCR: PDF extraction failed:", error)
      throw new Error("Failed to extract text from PDF")
    }
  }
}

// Export singleton instance
export const ocrService = new DeepSeekOCRService()
