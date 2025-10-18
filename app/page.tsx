"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { FileUploadZone } from "@/components/file-upload-zone"
import { FilePreview } from "@/components/file-preview"
import { FormatSelector } from "@/components/format-selector"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { FileFormat } from "@/lib/types"
import { ArrowRight } from "lucide-react"
import { useFileContext } from "@/lib/file-context"
import { MeshGradient } from "@paper-design/shaders-react"

export default function HomePage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [sourceFormat, setSourceFormat] = useState<FileFormat | null>(null)
  const [targetFormat, setTargetFormat] = useState<FileFormat | null>(null)
  const router = useRouter()
  const { setFileData } = useFileContext()

  const handleFileSelect = (file: File, format: FileFormat) => {
    setSelectedFile(file)
    setSourceFormat(format)
    setTargetFormat(null)
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    setSourceFormat(null)
    setTargetFormat(null)
  }

  const handleConvert = () => {
    if (selectedFile && sourceFormat && targetFormat) {
      setFileData(selectedFile, sourceFormat, targetFormat)
      router.push(`/convert?from=${sourceFormat}&to=${targetFormat}`)
    }
  }

  return (
    <div className="md:min-h-screen bg-background relative overflow-hidden pt-14">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <MeshGradient colors={["#000000", "#1a1a1a", "#0070f3", "#000000"]} speed={0.01} />
      </div>

      <main className="relative z-10">
        <div className="container mx-auto px-4 py-12 pb-8 md:py-32">
          <div className="max-w-4xl mx-auto space-y-12 md:space-y-20">
            <div className="text-center space-y-6 md:space-y-8 cursor-default">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-balance leading-[1.2]">
                Convert your files <span className="highlight-privately">privately</span>.
                <br />
                Your data never leaves <span className="whitespace-nowrap">your device</span>.
              </h1>
            </div>

            <Card className="shadow-2xl border-border/40 backdrop-blur-md bg-card/90 hover:shadow-[0_20px_70px_-15px_rgba(0,0,0,0.3)] transition-all duration-500">
              <CardHeader className="space-y-1 md:space-y-2 pb-4 md:pb-6">
                <CardTitle className="text-xl md:text-2xl">Upload & Convert</CardTitle>
                <CardDescription className="text-sm md:text-base">
                  Select a file and choose your desired output format
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 md:space-y-8">
                {!selectedFile ? (
                  <FileUploadZone onFileSelect={handleFileSelect} />
                ) : (
                  <div className="space-y-4">
                    <FilePreview file={selectedFile} format={sourceFormat!} onRemove={handleRemoveFile} />
                    <FormatSelector
                      sourceFormat={sourceFormat!}
                      targetFormat={targetFormat}
                      onTargetFormatChange={setTargetFormat}
                    />
                    <Button onClick={handleConvert} disabled={!targetFormat} className="w-full" size="lg">
                      Convert File
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
