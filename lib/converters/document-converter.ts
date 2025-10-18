import mammoth from "mammoth"
import html2pdf from "html2pdf.js"

export async function docxToPdf(file: File): Promise<Blob> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.convertToHtml({ arrayBuffer })
    const html = result.value

    if (result.messages && result.messages.length > 0) {
      console.log("Mammoth conversion messages:", result.messages)
    }

    const container = document.createElement("div")
    container.innerHTML = html
    container.style.padding = "20px"
    container.style.fontFamily = "Arial, sans-serif"
    container.style.fontSize = "12pt"
    container.style.lineHeight = "1.6"
    container.style.color = "#000000"
    container.style.backgroundColor = "#ffffff"

    const options = {
      margin: 10,
      filename: "converted.pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    }

    const pdfBlob = await html2pdf().set(options).from(container).toPdf().output("blob")

    return pdfBlob
  } catch (error) {
    console.error("Error converting DOCX to PDF:", error)
    throw new Error("Failed to convert DOCX to PDF. The file may be corrupted or in an unsupported format.")
  }
}
