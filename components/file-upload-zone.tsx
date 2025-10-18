"use client"

import type React from "react"

import { useCallback, useState } from "react"
import { Upload, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { detectFileFormat, formatFileSize } from "@/lib/utils/file-utils"
import type { FileFormat } from "@/lib/types"

interface FileUploadZoneProps {
  onFileSelect: (file: File, format: FileFormat) => void
  accept?: string
  maxSize?: number
}

export function FileUploadZone({ onFileSelect, accept, maxSize = 1024 * 1024 * 1024 }: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const processFile = useCallback(
    (file: File) => {
      setError(null)

      if (file.size > maxSize) {
        setError(`File size exceeds ${formatFileSize(maxSize)}`)
        return
      }

      const format = detectFileFormat(file)
      if (!format) {
        setError("Unsupported file format")
        return
      }

      onFileSelect(file, format)
    },
    [maxSize, onFileSelect],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        processFile(files[0])
      }
    },
    [processFile],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0) {
        processFile(files[0])
      }
    },
    [processFile],
  )

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 md:p-12 transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
        )}
      >
        <input
          type="file"
          id="file-upload"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={handleFileInput}
          accept={accept}
        />
        <div className="flex flex-col items-center justify-center gap-3 md:gap-4 text-center pointer-events-none">
          <div className="rounded-full bg-primary/10 p-3 md:p-4">
            <Upload className="w-6 h-6 md:w-8 md:h-8 text-primary" />
          </div>
          <div className="space-y-1 md:space-y-2">
            <p className="text-base md:text-lg font-medium">Drop your file here or click to browse</p>
            <p className="text-xs md:text-sm text-muted-foreground">
              Supports PDF, DOCX, XLSX, images, audio, and video files
            </p>
            <p className="text-xs text-muted-foreground">Maximum file size: {formatFileSize(maxSize)}</p>
          </div>
        </div>
      </div>
      {error && (
        <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center justify-between">
          <p className="text-sm text-destructive">{error}</p>
          <button onClick={() => setError(null)} className="text-destructive hover:text-destructive/80">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
