import { PDFDocument } from "pdf-lib"
import * as pdfjsLib from "pdfjs-dist"

if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
}

export async function pdfToImages(file: File, format: "png" | "jpg" = "png"): Promise<Blob[]> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const images: Blob[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 2.0 })

    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")!
    canvas.width = viewport.width
    canvas.height = viewport.height

    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), `image/${format}`, 0.95)
    })

    images.push(blob)
  }

  return images
}

export async function pdfToText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  let fullText = ""

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items.map((item: any) => item.str).join(" ")
    fullText += pageText + "\n\n"
  }

  return fullText
}

export async function imageToPdf(file: File): Promise<Blob> {
  const pdfDoc = await PDFDocument.create()
  const imageBytes = await file.arrayBuffer()

  let image
  if (file.type === "image/png") {
    image = await pdfDoc.embedPng(imageBytes)
  } else if (file.type === "image/jpeg" || file.type === "image/jpg") {
    image = await pdfDoc.embedJpg(imageBytes)
  } else {
    // Convert to PNG first for unsupported formats
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")!
    const img = new Image()

    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      img.src = URL.createObjectURL(file)
    })

    canvas.width = img.width
    canvas.height = img.height
    ctx.drawImage(img, 0, 0)

    const pngBlob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), "image/png")
    })

    const pngBytes = await pngBlob.arrayBuffer()
    image = await pdfDoc.embedPng(pngBytes)
  }

  const page = pdfDoc.addPage([image.width, image.height])
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: image.width,
    height: image.height,
  })

  const pdfBytes = await pdfDoc.save()
  return new Blob([pdfBytes], { type: "application/pdf" })
}
