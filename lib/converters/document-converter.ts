import mammoth from "mammoth"
import html2pdf from "html2pdf.js"

export async function docxToPdf(file: File): Promise<Blob> {
  try {
    const arrayBuffer = await file.arrayBuffer()

    console.log("[v0] Converting DOCX to HTML...")
    const result = await mammoth.convertToHtml({
      arrayBuffer,
      convertImage: mammoth.images.imgElement((image) =>
        image.read("base64").then((imageBuffer) => ({
          src: "data:" + image.contentType + ";base64," + imageBuffer,
        })),
      ),
    })

    const html = result.value
    console.log("[v0] HTML generated, length:", html.length)
    console.log("[v0] HTML preview:", html.substring(0, 500))

    if (result.messages && result.messages.length > 0) {
      console.log("[v0] Mammoth conversion messages:", result.messages)
    }

    const container = document.createElement("div")
    container.innerHTML = html
    container.style.padding = "20px"
    container.style.fontFamily = "Arial, sans-serif"
    container.style.fontSize = "12pt"
    container.style.lineHeight = "1.6"
    container.style.color = "#000000"
    container.style.backgroundColor = "#ffffff"
    container.style.position = "absolute"
    container.style.left = "-9999px"
    container.style.top = "0"

    const images = container.querySelectorAll("img")
    console.log("[v0] Found", images.length, "images in document")
    images.forEach((img) => {
      img.style.maxWidth = "100%"
      img.style.height = "auto"
    })

    document.body.appendChild(container)

    await new Promise((resolve) => {
      if (images.length === 0) {
        resolve(null)
        return
      }

      let loadedCount = 0
      const checkAllLoaded = () => {
        loadedCount++
        console.log("[v0] Image loaded:", loadedCount, "/", images.length)
        if (loadedCount === images.length) {
          resolve(null)
        }
      }

      images.forEach((img) => {
        if (img.complete) {
          checkAllLoaded()
        } else {
          img.onload = checkAllLoaded
          img.onerror = checkAllLoaded
        }
      })

      setTimeout(() => resolve(null), 5000)
    })

    console.log("[v0] Generating PDF from HTML...")
    const options = {
      margin: 10,
      filename: "converted.pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, allowTaint: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    }

    const pdfBlob = await html2pdf().set(options).from(container).toPdf().output("blob")

    document.body.removeChild(container)

    console.log("[v0] PDF generated, size:", pdfBlob.size, "bytes")
    return pdfBlob
  } catch (error) {
    console.error("[v0] Error converting DOCX to PDF:", error)
    throw new Error("Failed to convert DOCX to PDF. The file may be corrupted or in an unsupported format.")
  }
}
