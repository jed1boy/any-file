import { describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  imageToPdf: vi.fn(async () => new Blob(["pdf"])),
  convertImage: vi.fn(async () => new Blob(["image"])),
  imageToText: vi.fn(async () => new Blob(["ocr"])),
  convertAudio: vi.fn(async () => new Blob(["audio"])),
  convertVideo: vi.fn(async () => new Blob(["video"])),
  extractAudioFromVideo: vi.fn(async () => new Blob(["audioFromVideo"])),
}))

vi.mock("@/lib/converters/pdf-converter", () => ({
  imageToPdf: mocks.imageToPdf,
  pdfToImages: vi.fn(async () => [new Blob(["img"])]),
  pdfToText: vi.fn(async () => "text"),
  pdfToDocx: vi.fn(async () => new Blob(["docx"])),
}))

vi.mock("@/lib/converters/image-converter", () => ({
  convertImage: mocks.convertImage,
}))

vi.mock("@/lib/converters/ocr-converter", () => ({
  imageToText: mocks.imageToText,
}))

vi.mock("@/lib/converters/media-converter", () => ({
  convertAudio: mocks.convertAudio,
  convertVideo: mocks.convertVideo,
  extractAudioFromVideo: mocks.extractAudioFromVideo,
}))

import { ConversionError, convertFile } from "./index"

describe("convertFile", () => {
  it("routes image to PDF through the image converter", async () => {
    const file = new File(["image-bytes"], "sample.jpg", { type: "image/jpeg" })
    await convertFile(file, "jpg", "pdf")

    expect(mocks.imageToPdf).toHaveBeenCalledTimes(1)
    expect(mocks.imageToPdf).toHaveBeenCalledWith(file)
  })

  it("throws a ConversionError for unsupported formats", async () => {
    const file = new File(["data"], "frame.gif", { type: "image/gif" })

    await expect(convertFile(file, "gif", "txt")).rejects.toBeInstanceOf(ConversionError)
  })

  it("validates the provided file matches the declared source format", async () => {
    const file = new File(["data"], "report.pdf", { type: "application/pdf" })

    await expect(convertFile(file, "jpg", "pdf")).rejects.toThrow(/does not match declared source format/)
  })
})
