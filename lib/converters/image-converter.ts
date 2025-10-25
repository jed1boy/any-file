export async function convertImage(file: File, targetFormat: "png" | "jpg" | "jpeg" | "webp" | "gif"): Promise<Blob> {
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

      // Handle GIF conversion (note: animated GIFs will become static)
      if (targetFormat === "gif") {
        console.warn("[v0] Converting to GIF will result in a static image (animation not preserved)")
      }

      const mimeType = targetFormat === "jpg" ? "jpeg" : targetFormat

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error("Failed to convert image"))
          }
        },
        `image/${mimeType}`,
        0.95,
      )
    }

    img.onerror = () => reject(new Error("Failed to load image"))
    img.src = URL.createObjectURL(file)
  })
}
