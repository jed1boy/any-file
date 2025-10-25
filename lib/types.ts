export type FileFormat =
  | "pdf"
  | "docx"
  | "xlsx"
  | "txt"
  | "jpg"
  | "jpeg"
  | "png"
  | "webp"
  | "gif"
  | "mp3"
  | "wav"
  | "ogg"
  | "aac"
  | "flac"
  | "m4a"
  | "mp4"
  | "webm"
  | "avi"
  | "mov"
  | "mkv"
  | "flv"

export interface ConversionOption {
  from: FileFormat
  to: FileFormat[]
}

export const CONVERSION_OPTIONS: ConversionOption[] = [
  { from: "pdf", to: ["docx", "txt", "jpg", "png"] },
  { from: "docx", to: ["pdf", "txt"] },
  { from: "xlsx", to: ["pdf"] },
  { from: "txt", to: ["pdf", "docx"] },
  { from: "jpg", to: ["png", "webp", "pdf", "txt"] }, // Added txt for OCR
  { from: "jpeg", to: ["png", "webp", "pdf", "txt"] }, // Added txt for OCR
  { from: "png", to: ["jpg", "webp", "pdf", "txt"] }, // Added txt for OCR
  { from: "webp", to: ["jpg", "png", "pdf", "txt"] }, // Added txt for OCR
  { from: "gif", to: ["png", "jpg", "webp"] },
  { from: "mp3", to: ["wav", "ogg", "aac", "flac", "m4a"] },
  { from: "wav", to: ["mp3", "ogg", "aac", "flac", "m4a"] },
  { from: "ogg", to: ["mp3", "wav", "aac", "flac", "m4a"] },
  { from: "aac", to: ["mp3", "wav", "ogg", "flac", "m4a"] },
  { from: "flac", to: ["mp3", "wav", "ogg", "aac", "m4a"] },
  { from: "m4a", to: ["mp3", "wav", "ogg", "aac", "flac"] },
  { from: "mp4", to: ["webm", "avi", "mov", "mkv", "flv", "mp3", "wav", "aac", "m4a"] },
  { from: "webm", to: ["mp4", "avi", "mov", "mkv", "mp3", "wav", "aac", "m4a"] },
  { from: "avi", to: ["mp4", "webm", "mov", "mkv", "mp3", "wav", "aac", "m4a"] },
  { from: "mov", to: ["mp4", "webm", "avi", "mkv", "mp3", "wav", "aac", "m4a"] },
  { from: "mkv", to: ["mp4", "webm", "avi", "mov", "mp3", "wav", "aac", "m4a"] },
  { from: "flv", to: ["mp4", "webm", "avi", "mov", "mp3", "wav", "aac", "m4a"] },
]

export interface ConversionJob {
  id: string
  file: File
  sourceFormat: FileFormat
  targetFormat: FileFormat
  status: "pending" | "converting" | "completed" | "error"
  progress: number
  result?: Blob
  error?: string
}
