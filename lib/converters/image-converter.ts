export async function convertImage(file: File, targetFormat: "png" | "jpg" | "jpeg" | "webp"): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"

    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = img.width
      canvas.height = img.height

      const ctx = canvas.getContext("2d")!

      // JPG doesn't support transparency, so add white background
      if (targetFormat === "jpg" || targetFormat === "jpeg") {
        ctx.fillStyle = "#FFFFFF"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }

      ctx.drawImage(img, 0, 0)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error("Failed to convert image"))
          }
        },
        `image/${targetFormat === "jpg" ? "jpeg" : targetFormat}`,
        0.95,
      )
    }

    img.onerror = () => reject(new Error("Failed to load image"))
    img.src = URL.createObjectURL(file)
  })
}
