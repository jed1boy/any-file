import type { FileFormat } from "@/lib/types"
import { CONVERSION_OPTIONS } from "@/lib/types"
import { pdfToImages, pdfToText, imageToPdf } from "./pdf-converter"
import { convertImage } from "./image-converter"
import { convertAudio, convertVideo, extractAudioFromVideo } from "./media-converter"
import { imageToText } from "./ocr-converter"
import { PDFDocument, rgb, StandardFonts } from "pdf-lib"
import jsPDF from "jspdf"
// @ts-ignore - docshift types
import { toHtml } from "docshift"
import mammoth from "mammoth"

export class ConversionError extends Error {
  constructor(message: string, public readonly sourceFormat?: FileFormat, public readonly targetFormat?: FileFormat) {
    super(message)
    this.name = "ConversionError"
  }
}

// pdf-lib's WinAnsi encoding can't handle all Unicode characters
function sanitizeTextForPdf(text: string): string {
  return text
    .replace(/\t/g, "    ")
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, "")
    .replace(/[^\x20-\x7E\n\r\u00A0-\u00FF]/g, "")
}

function htmlToText(html: string): string {
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<li>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  return text
}

function assertSupportedConversion(sourceFormat: FileFormat, targetFormat: FileFormat): void {
  const option = CONVERSION_OPTIONS.find((item) => item.from === sourceFormat)
  if (!option || !option.to.includes(targetFormat)) {
    throw new ConversionError(`Conversion from ${sourceFormat} to ${targetFormat} is not supported`, sourceFormat, targetFormat)
  }
}

const FORMAT_ALIASES: Partial<Record<FileFormat, string[]>> = {
  jpg: ["jpg", "jpeg"],
  jpeg: ["jpeg", "jpg"],
}

function ensureFileMatchesFormat(file: File, sourceFormat: FileFormat): void {
  const extension = file.name.split(".").pop()?.toLowerCase()
  if (!extension) return

  const aliasExtensions = FORMAT_ALIASES[sourceFormat] ?? []
  const allowedExtensions = new Set<string>([sourceFormat, ...aliasExtensions])

  if (!allowedExtensions.has(extension)) {
    throw new ConversionError(
      `File extension ".${extension}" does not match declared source format "${sourceFormat}". Please select the correct file.`,
      sourceFormat,
      extension as FileFormat,
    )
  }
}

async function textToPdf(file: File): Promise<Blob> {
  const text = sanitizeTextForPdf(await file.text())
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const fontSize = 12
  const lineHeight = fontSize * 1.2
  const margin = 50
  const pageWidth = 595.28
  const pageHeight = 841.89
  const maxWidth = pageWidth - 2 * margin

  let page = pdfDoc.addPage([pageWidth, pageHeight])
  let yPosition = pageHeight - margin

  const lines = text.split("\n")

  for (const line of lines) {
    const words = line.split(" ")
    let currentLine = ""

    for (const word of words) {
      const testLine = currentLine + (currentLine ? " " : "") + word
      const textWidth = font.widthOfTextAtSize(testLine, fontSize)

      if (textWidth > maxWidth && currentLine) {
        page.drawText(currentLine, {
          x: margin,
          y: yPosition,
          size: fontSize,
          font: font,
          color: rgb(0, 0, 0),
        })

        yPosition -= lineHeight
        currentLine = word

        if (yPosition < margin) {
          page = pdfDoc.addPage([pageWidth, pageHeight])
          yPosition = pageHeight - margin
        }
      } else {
        currentLine = testLine
      }
    }

    if (currentLine) {
      page.drawText(currentLine, {
        x: margin,
        y: yPosition,
        size: fontSize,
        font: font,
        color: rgb(0, 0, 0),
      })

      yPosition -= lineHeight

      if (yPosition < margin) {
        page = pdfDoc.addPage([pageWidth, pageHeight])
        yPosition = pageHeight - margin
      }
    }
  }

  const pdfBytes = await pdfDoc.save()
  return new Blob([pdfBytes], { type: "application/pdf" })
}

async function docxToText(file: File): Promise<Blob> {
  try {
    const html = await toHtml(file)
    const text = htmlToText(html)
    return new Blob([text], { type: "text/plain" })
  } catch (error) {
    console.error("Error converting DOCX to text:", error)
    throw new Error("Failed to convert DOCX file. The file may be corrupted or in an unsupported format.")
  }
}

async function docxToPdf(file: File): Promise<Blob> {
  try {
    console.log("[v0] Starting DOCX to PDF conversion...")

    console.log("[v0] Converting DOCX to HTML with mammoth...")
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.convertToHtml({ arrayBuffer })
    const html = result.value

    console.log("[v0] HTML generated, length:", html.length)

    if (result.messages.length > 0) {
      console.log("[v0] Conversion messages:", result.messages)
    }

    // Convert HTML to plain text for better PDF rendering
    const text = htmlToText(html)
    console.log("[v0] Extracted text length:", text.length)

    // Create PDF using jsPDF with proper text rendering
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4",
      compress: true,
    })

    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 40
    const maxWidth = pageWidth - 2 * margin
    const fontSize = 11
    const lineHeight = fontSize * 1.5

    pdf.setFontSize(fontSize)
    pdf.setTextColor(0, 0, 0) // Ensure black text

    let yPosition = margin
    const lines = text.split("\n")

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Handle empty lines (paragraph breaks)
      if (!line.trim()) {
        yPosition += lineHeight * 0.5
        continue
      }

      // Split long lines to fit page width
      const words = line.split(" ")
      let currentLine = ""

      for (const word of words) {
        const testLine = currentLine + (currentLine ? " " : "") + word
        const textWidth = pdf.getTextWidth(testLine)

        if (textWidth > maxWidth && currentLine) {
          // Check if we need a new page
          if (yPosition + lineHeight > pageHeight - margin) {
            pdf.addPage()
            yPosition = margin
          }

          pdf.text(currentLine, margin, yPosition)
          yPosition += lineHeight
          currentLine = word
        } else {
          currentLine = testLine
        }
      }

      // Print remaining text
      if (currentLine) {
        // Check if we need a new page
        if (yPosition + lineHeight > pageHeight - margin) {
          pdf.addPage()
          yPosition = margin
        }

        pdf.text(currentLine, margin, yPosition)
        yPosition += lineHeight
      }
    }

    console.log("[v0] PDF created with", pdf.getNumberOfPages(), "page(s)")

    const pdfBlob = pdf.output("blob")
    console.log("[v0] PDF generated successfully, size:", pdfBlob.size, "bytes")
    return pdfBlob
  } catch (error) {
    console.error("[v0] Error converting DOCX to PDF:", error)
    throw new Error("Failed to convert DOCX to PDF. The file may be corrupted or in an unsupported format.")
  }
}

async function pdfToDocx(file: File): Promise<Blob> {
  try {
    console.log("[v0] Starting PDF to DOCX conversion...")

    // Dynamic imports for browser-only libraries
    const pdfjsLib = await import("pdfjs-dist")
    const { Document, Paragraph, TextRun, Packer } = await import("docx")

    // Set up PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    console.log("[v0] PDF loaded, pages:", pdf.numPages)

    const paragraphs: any[] = []

    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()

      console.log("[v0] Processing page", pageNum, "items:", textContent.items.length)

      // Group text items into lines
      let currentLine = ""
      let lastY = -1

      for (const item of textContent.items) {
        if ("str" in item) {
          const y = item.transform[5]

          // New line detected (different Y position)
          if (lastY !== -1 && Math.abs(y - lastY) > 5) {
            if (currentLine.trim()) {
              paragraphs.push(
                new Paragraph({
                  children: [new TextRun(currentLine.trim())],
                  spacing: { after: 200 },
                }),
              )
            }
            currentLine = item.str
          } else {
            currentLine += item.str
          }

          lastY = y
        }
      }

      // Add the last line
      if (currentLine.trim()) {
        paragraphs.push(
          new Paragraph({
            children: [new TextRun(currentLine.trim())],
            spacing: { after: 200 },
          }),
        )
      }

      // Add page break except for last page
      if (pageNum < pdf.numPages) {
        paragraphs.push(
          new Paragraph({
            children: [new TextRun("")],
            pageBreakBefore: true,
          }),
        )
      }
    }

    console.log("[v0] Creating DOCX document with", paragraphs.length, "paragraphs")

    // Create DOCX document
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs,
        },
      ],
    })

    // Generate DOCX blob
    const blob = await Packer.toBlob(doc)
    console.log("[v0] DOCX generated successfully, size:", blob.size, "bytes")

    return blob
  } catch (error) {
    console.error("[v0] Error converting PDF to DOCX:", error)
    throw new Error("Failed to convert PDF to DOCX. The file may be corrupted or password-protected.")
  }
}

export async function convertFile(file: File, sourceFormat: FileFormat, targetFormat: FileFormat): Promise<Blob> {
  assertSupportedConversion(sourceFormat, targetFormat)
  ensureFileMatchesFormat(file, sourceFormat)

  try {
    // DOCX to PDF conversion
    if (sourceFormat === "docx" && targetFormat === "pdf") {
      return await docxToPdf(file)
    }

    // DOCX to TXT conversion
    if (sourceFormat === "docx" && targetFormat === "txt") {
      return await docxToText(file)
    }

    // TXT to PDF conversion
    if (sourceFormat === "txt" && targetFormat === "pdf") {
      return await textToPdf(file)
    }

    // PDF conversions
    if (sourceFormat === "pdf" && (targetFormat === "jpg" || targetFormat === "png")) {
      const images = await pdfToImages(file, targetFormat)
      if (!images.length) {
        throw new ConversionError(
          "Unable to render PDF pages. Please verify the document is valid and not password-protected.",
          sourceFormat,
          targetFormat,
        )
      }
      return images[0]
    }

    if (sourceFormat === "pdf" && targetFormat === "txt") {
      const text = await pdfToText(file)
      return new Blob([text], { type: "text/plain" })
    }

    if (sourceFormat === "pdf" && targetFormat === "docx") {
      return await pdfToDocx(file)
    }

    if (sourceFormat === "pdf" && targetFormat === "xlsx") {
      throw new ConversionError(
        "PDF to XLSX conversion is not yet implemented. Currently supported: PDF → TXT, PDF → DOCX, PDF → JPG/PNG",
        sourceFormat,
        targetFormat,
      )
    }

    // Image to PDF
    if (
      (sourceFormat === "jpg" ||
        sourceFormat === "jpeg" ||
        sourceFormat === "png" ||
        sourceFormat === "webp" ||
        sourceFormat === "gif") &&
      targetFormat === "pdf"
    ) {
      return await imageToPdf(file)
    }

    // Image to text OCR conversion
    if (
      (sourceFormat === "jpg" || sourceFormat === "jpeg" || sourceFormat === "png" || sourceFormat === "webp") &&
      targetFormat === "txt"
    ) {
      return await imageToText(file)
    }

    if (
      (sourceFormat === "jpg" ||
        sourceFormat === "jpeg" ||
        sourceFormat === "png" ||
        sourceFormat === "webp" ||
        sourceFormat === "gif") &&
      (targetFormat === "jpg" ||
        targetFormat === "jpeg" ||
        targetFormat === "png" ||
        targetFormat === "webp" ||
        targetFormat === "gif")
    ) {
      return await convertImage(file, targetFormat)
    }

    // Audio conversions
    if (
      (sourceFormat === "mp3" ||
        sourceFormat === "wav" ||
        sourceFormat === "ogg" ||
        sourceFormat === "aac" ||
        sourceFormat === "flac" ||
        sourceFormat === "m4a") &&
      (targetFormat === "mp3" ||
        targetFormat === "wav" ||
        targetFormat === "ogg" ||
        targetFormat === "aac" ||
        targetFormat === "flac" ||
        targetFormat === "m4a")
    ) {
      // Use browser-based conversion for all audio formats
      return await convertAudio(file, targetFormat as any)
    }

    // Video to Audio conversion
    if (
      (sourceFormat === "mp4" ||
        sourceFormat === "webm" ||
        sourceFormat === "avi" ||
        sourceFormat === "mov" ||
        sourceFormat === "mkv" ||
        sourceFormat === "flv") &&
      (targetFormat === "mp3" ||
        targetFormat === "wav" ||
        targetFormat === "ogg" ||
        targetFormat === "aac" ||
        targetFormat === "flac" ||
        targetFormat === "m4a")
    ) {
      return await extractAudioFromVideo(file, targetFormat)
    }

    // Video conversions
    if (
      (sourceFormat === "mp4" ||
        sourceFormat === "webm" ||
        sourceFormat === "avi" ||
        sourceFormat === "mov" ||
        sourceFormat === "mkv" ||
        sourceFormat === "flv") &&
      (targetFormat === "mp4" ||
        targetFormat === "webm" ||
        targetFormat === "avi" ||
        targetFormat === "mov" ||
        targetFormat === "mkv" ||
        targetFormat === "flv")
    ) {
      return await convertVideo(file, targetFormat)
    }

    throw new ConversionError(`Conversion from ${sourceFormat} to ${targetFormat} is not yet implemented`, sourceFormat, targetFormat)
  } catch (error) {
    if (error instanceof ConversionError) {
      throw error
    }

    throw new ConversionError(
      `Failed to convert ${file.name || "file"} from ${sourceFormat} to ${targetFormat}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      sourceFormat,
      targetFormat,
    )
  }
}
