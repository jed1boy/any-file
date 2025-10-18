"use client"

import { type File, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatFileSize, getFormatIcon } from "@/lib/utils/file-utils"
import type { FileFormat } from "@/lib/types"

interface FilePreviewProps {
  file: File
  format: FileFormat
  onRemove: () => void
}

export function FilePreview({ file, format, onRemove }: FilePreviewProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-2xl">
            {getFormatIcon(format)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{file.name}</p>
            <p className="text-sm text-muted-foreground">
              {format.toUpperCase()} • {formatFileSize(file.size)}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onRemove}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
