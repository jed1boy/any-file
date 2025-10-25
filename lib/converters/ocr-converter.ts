/**
 * OCR Converter
 * Converts images and PDFs to text using DeepSeek OCR
 */

import { ocrService } from "../services/ocr-service"

/**
 * Convert image to text using OCR
 */
export async function imageToText(imageBlob: Blob): Promise<Blob> {
  console.log("[v0] Converting image to text using OCR")

  try {
    const result = await ocrService.extractTextFromImage(imageBlob, {
      enhanceImage: true,
      language: "auto",
      preserveLayout: true,
    })

    // Create text file with extracted content
    const textContent = `Extracted Text (Confidence: ${(result.confidence * 100).toFixed(1)}%)\n\n${result.text}`

    const textBlob = new Blob([textContent], { type: "text/plain" })

    console.log("[v0] Image to text conversion completed")
    return textBlob
  } catch (error) {
    console.error("[v0] Image to text conversion failed:", error)
    throw new Error("Failed to extract text from image")
  }
}

/**
 * Convert PDF to text using OCR
 */
export async function pdfToTextOCR(pdfBlob: Blob): Promise<Blob> {
  console.log("[v0] Converting PDF to text using OCR")

  try {
    const result = await ocrService.extractTextFromPDF(pdfBlob, {
      language: "auto",
      preserveLayout: true,
    })

    // Create text file with extracted content
    const textContent = `Extracted Text from PDF\n\n${result.text}`

    const textBlob = new Blob([textContent], { type: "text/plain" })

    console.log("[v0] PDF to text conversion completed")
    return textBlob
  } catch (error) {
    console.error("[v0] PDF to text conversion failed:", error)
    throw new Error("Failed to extract text from PDF")
  }
}
