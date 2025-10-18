import type { FileFormat } from "@/lib/types"
import { pdfToImages, pdfToText, imageToPdf } from "./pdf-converter"
import { convertImage } from "./image-converter"
import { convertAudio, convertVideo, extractAudioFromVideo } from "./media-converter"
import { PDFDocument, rgb, StandardFonts } from "pdf-lib"
import jsPDF from "jspdf"
// @ts-ignore - docshift types
import { toHtml } from "docshift"

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
    const html2canvas = (await import("html2canvas")).default

    const html = await toHtml(file)

    // Render HTML off-screen to convert to PDF
    const container = document.createElement("div")
    container.style.position = "absolute"
    container.style.left = "-9999px"
    container.style.top = "0"
    container.style.width = "210mm"
    container.style.padding = "20mm"
    container.style.backgroundColor = "white"
    container.style.fontFamily = "Arial, sans-serif"
    container.style.fontSize = "12pt"
    container.style.lineHeight = "1.5"
    container.innerHTML = html

    document.body.appendChild(container)

    try {
      const images = container.querySelectorAll("img")

      if (images.length > 0) {
        await Promise.all(
          Array.from(images).map((img) => {
            return new Promise<void>((resolve) => {
              if (img.complete) {
                resolve()
              } else {
                img.onload = () => resolve()
                img.onerror = () => resolve()
                setTimeout(() => resolve(), 5000)
              }
            })
          }),
        )
      }

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: "#ffffff",
        imageTimeout: 15000,
        removeContainer: false,
      })

      const imgData = canvas.toDataURL("image/png")
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      })

      const imgWidth = 210
      const pageHeight = 297
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight
      let position = 0

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      const pdfBlob = pdf.output("blob")
      return pdfBlob
    } finally {
      document.body.removeChild(container)
    }
  } catch (error) {
    console.error("Error converting DOCX to PDF:", error)
    throw new Error("Failed to convert DOCX to PDF. The file may be corrupted or in an unsupported format.")
  }
}

export async function convertFile(file: File, sourceFormat: FileFormat, targetFormat: FileFormat): Promise<Blob> {
  // PDF conversions
  if (sourceFormat === "pdf" && (targetFormat === "jpg" || targetFormat === "png")) {
    const images = await pdfToImages(file, targetFormat)
    return images[0]
  }

  if (sourceFormat === "pdf" && targetFormat === "txt") {
    const text = await pdfToText(file)
    return new Blob([text], { type: "text/plain" })
  }

  if (sourceFormat === "pdf" && (targetFormat === "docx" || targetFormat === "xlsx")) {
    throw new Error(
      `PDF to ${targetFormat.toUpperCase()} conversion is not yet implemented. Currently supported: PDF → TXT, PDF → JPG/PNG`,
    )
  }

  if (sourceFormat === "txt" && targetFormat === "pdf") {
    return await textToPdf(file)
  }

  if (sourceFormat === "txt" && targetFormat === "docx") {
    throw new Error("TXT to DOCX conversion is not yet implemented. Currently supported: TXT → PDF")
  }

  if (sourceFormat === "docx" && targetFormat === "txt") {
    return await docxToText(file)
  }

  if (sourceFormat === "docx" && targetFormat === "pdf") {
    return await docxToPdf(file)
  }

  if (sourceFormat === "xlsx" && targetFormat === "pdf") {
    throw new Error(
      "XLSX to PDF conversion is not yet implemented. Please use a spreadsheet application to export to PDF.",
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

  // Image format conversions
  if (
    (sourceFormat === "jpg" ||
      sourceFormat === "jpeg" ||
      sourceFormat === "png" ||
      sourceFormat === "webp" ||
      sourceFormat === "gif") &&
    (targetFormat === "jpg" || targetFormat === "jpeg" || targetFormat === "png" || targetFormat === "webp")
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
    // MP3/WAV conversions work everywhere using browser APIs
    if ((sourceFormat === "mp3" || sourceFormat === "wav") && (targetFormat === "mp3" || targetFormat === "wav")) {
      return await convertAudio(file, targetFormat)
    }

    // Other formats need FFmpeg
    return await extractAudioFromVideo(file, targetFormat)
  }

  // Video to audio
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

  throw new Error(`Conversion from ${sourceFormat} to ${targetFormat} is not yet implemented`)
}
