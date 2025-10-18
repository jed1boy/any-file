"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Download, Loader2, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { FileFormat } from "@/lib/types"
import { useFileContext } from "@/lib/file-context"

export const dynamic = "force-dynamic"

function ConvertPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { file, sourceFormat, targetFormat, clearFileData } = useFileContext()
  const [status, setStatus] = useState<"idle" | "converting" | "completed" | "error">("idle")
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [resultBlob, setResultBlob] = useState<Blob | null>(null)

  const urlSourceFormat = searchParams.get("from") as FileFormat
  const urlTargetFormat = searchParams.get("to") as FileFormat

  useEffect(() => {
    if (!file || !sourceFormat || !targetFormat) {
      console.log("[v0] No file in context, redirecting home")
      router.push("/")
      return
    }

    console.log("[v0] Starting conversion:", file.name, "from", sourceFormat, "to", targetFormat)
    handleConversion(file)
  }, [])

  const handleConversion = async (fileToConvert: File) => {
    if (!sourceFormat || !targetFormat) return

    console.log("[v0] Converting from", sourceFormat, "to", targetFormat)
    setStatus("converting")
    setProgress(0)
    setError(null)

    try {
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      const { convertFile } = await import("@/lib/converters")
      const result = await convertFile(fileToConvert, sourceFormat, targetFormat)

      clearInterval(progressInterval)
      setProgress(100)
      setResultBlob(result)
      setStatus("completed")
      console.log("[v0] Conversion completed successfully")
    } catch (err: any) {
      console.log("[v0] Conversion error:", err.message)
      setStatus("error")
      setError(err.message || "Conversion failed")
    }
  }

  const handleDownload = () => {
    if (!resultBlob || !file || !targetFormat) return

    console.log("[v0] Downloading converted file")
    const url = URL.createObjectURL(resultBlob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${file.name.split(".")[0]}.${targetFormat}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleBackHome = () => {
    clearFileData()
    router.push("/")
  }

  if (!file || !sourceFormat || !targetFormat) {
    return null
  }

  return (
    <div className="min-h-screen bg-background pt-14">
      <header className="border-b bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" onClick={handleBackHome}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Converting File</CardTitle>
              <CardDescription>
                {sourceFormat?.toUpperCase()} → {targetFormat?.toUpperCase()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {status === "converting" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-12 h-12 animate-spin text-primary" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Converting...</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} />
                  </div>
                </div>
              )}

              {status === "completed" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center py-8 text-green-600">
                    <CheckCircle2 className="w-12 h-12" />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold">Conversion Complete!</h3>
                    <p className="text-sm text-muted-foreground">Your file is ready to download</p>
                  </div>
                  <Button onClick={handleDownload} className="w-full" size="lg">
                    <Download className="w-4 h-4 mr-2" />
                    Download File
                  </Button>
                </div>
              )}

              {status === "error" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center py-8 text-destructive">
                    <XCircle className="w-12 h-12" />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold">Conversion Failed</h3>
                    <div className="text-sm text-muted-foreground space-y-2 max-w-md mx-auto">
                      <p className="font-medium text-foreground">{error}</p>
                      {error?.includes("SharedArrayBuffer") && (
                        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg text-left">
                          <p className="font-semibold text-blue-900 dark:text-blue-100 mb-2">💡 How to fix this:</p>
                          <ol className="list-decimal list-inside space-y-1 text-blue-800 dark:text-blue-200 text-xs">
                            <li>Deploy your app to production (Vercel, Netlify, etc.)</li>
                            <li>Video conversion will work automatically in production</li>
                            <li>
                              Or add these headers to your dev server:
                              <code className="block mt-1 p-2 bg-blue-100 dark:bg-blue-900 rounded text-[10px]">
                                Cross-Origin-Opener-Policy: same-origin
                                <br />
                                Cross-Origin-Embedder-Policy: require-corp
                              </code>
                            </li>
                          </ol>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" className="w-full bg-transparent" onClick={handleBackHome}>
                    Try Again
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

export default function ConvertPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      }
    >
      <ConvertPageContent />
    </Suspense>
  )
}
