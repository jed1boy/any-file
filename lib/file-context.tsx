"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import type { FileFormat } from "./types"
import { storeFileInIndexedDB, getFileFromIndexedDB, deleteFileFromIndexedDB } from "./utils/indexeddb"

interface FileContextType {
  file: File | null
  sourceFormat: FileFormat | null
  targetFormat: FileFormat | null
  setFileData: (file: File, source: FileFormat, target: FileFormat) => void
  clearFileData: () => void
}

const FileContext = createContext<FileContextType | undefined>(undefined)

async function storeFileInSession(file: File, source: FileFormat, target: FileFormat) {
  try {
    // Store metadata
    sessionStorage.setItem(
      "fileMetadata",
      JSON.stringify({
        name: file.name,
        type: file.type,
        size: file.size,
        sourceFormat: source,
        targetFormat: target,
      }),
    )

    console.log("[v0] Storing file in IndexedDB...")
    await storeFileInIndexedDB("currentFile", file)
    console.log("[v0] File stored successfully in IndexedDB")
  } catch (e) {
    console.error("[v0] Error storing file:", e)
    throw e
  }
}

async function retrieveFileFromSession(): Promise<{
  file: File | null
  source: FileFormat | null
  target: FileFormat | null
}> {
  try {
    const metadataStr = sessionStorage.getItem("fileMetadata")

    if (!metadataStr) {
      return { file: null, source: null, target: null }
    }

    const metadata = JSON.parse(metadataStr)

    console.log("[v0] Retrieving file from IndexedDB...")
    const file = await getFileFromIndexedDB("currentFile")

    if (file) {
      console.log("[v0] File retrieved from IndexedDB:", file.name)
      return {
        file,
        source: metadata.sourceFormat,
        target: metadata.targetFormat,
      }
    }

    return { file: null, source: metadata.sourceFormat, target: metadata.targetFormat }
  } catch (e) {
    console.error("[v0] Error retrieving file:", e)
    return { file: null, source: null, target: null }
  }
}

export function FileProvider({ children }: { children: ReactNode }) {
  const [file, setFile] = useState<File | null>(null)
  const [sourceFormat, setSourceFormat] = useState<FileFormat | null>(null)
  const [targetFormat, setTargetFormat] = useState<FileFormat | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    retrieveFileFromSession().then(({ file: storedFile, source, target }) => {
      if (storedFile) {
        console.log("[v0] Restored file from session:", storedFile.name)
        setFile(storedFile)
        setSourceFormat(source)
        setTargetFormat(target)
      }
      setIsHydrated(true)
    })
  }, [])

  const setFileData = async (newFile: File, source: FileFormat, target: FileFormat) => {
    console.log("[v0] Setting file data:", newFile.name, source, "->", target)
    setFile(newFile)
    setSourceFormat(source)
    setTargetFormat(target)
    await storeFileInSession(newFile, source, target)
  }

  const clearFileData = () => {
    setFile(null)
    setSourceFormat(null)
    setTargetFormat(null)
    sessionStorage.removeItem("fileMetadata")
    deleteFileFromIndexedDB("currentFile").catch((e) => console.error("[v0] Error clearing IndexedDB:", e))
  }

  return (
    <FileContext.Provider value={{ file, sourceFormat, targetFormat, setFileData, clearFileData }}>
      {children}
    </FileContext.Provider>
  )
}

export function useFileContext() {
  const context = useContext(FileContext)
  if (context === undefined) {
    throw new Error("useFileContext must be used within a FileProvider")
  }
  return context
}
