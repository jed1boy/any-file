import type { FileFormat } from "@/lib/types"

export function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || ""
}

export function detectFileFormat(file: File): FileFormat | null {
  const ext = getFileExtension(file.name)
  const validFormats: FileFormat[] = [
    "pdf",
    "docx",
    "xlsx",
    "txt",
    "jpg",
    "jpeg",
    "png",
    "webp",
    "gif",
    "mp3",
    "wav",
    "ogg",
    "aac",
    "flac",
    "m4a",
    "mp4",
    "webm",
    "avi",
    "mov",
    "mkv",
    "flv",
  ]

  if (validFormats.includes(ext as FileFormat)) {
    return ext as FileFormat
  }

  return null
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
}

export function getFormatIcon(format: FileFormat): string {
  const icons: Record<FileFormat, string> = {
    pdf: "📄",
    docx: "📝",
    xlsx: "📊",
    txt: "📃",
    jpg: "🖼️",
    jpeg: "🖼️",
    png: "🖼️",
    webp: "🖼️",
    gif: "🖼️",
    mp3: "🎵",
    wav: "🎵",
    ogg: "🎵",
    aac: "🎵",
    flac: "🎵",
    m4a: "🎵",
    mp4: "🎬",
    webm: "🎬",
    avi: "🎬",
    mov: "🎬",
    mkv: "🎬",
    flv: "🎬",
  }

  return icons[format] || "📁"
}
