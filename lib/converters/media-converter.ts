import { FFmpeg } from "@ffmpeg/ffmpeg"
import { toBlobURL, fetchFile } from "@ffmpeg/util"

export async function convertAudio(file: File, targetFormat: "mp3" | "wav"): Promise<Blob> {
  return new Promise(async (resolve, reject) => {
    try {
      const audioContext = new AudioContext()
      const arrayBuffer = await file.arrayBuffer()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

      const offlineContext = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate,
      )

      const source = offlineContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(offlineContext.destination)
      source.start()

      const renderedBuffer = await offlineContext.startRendering()

      if (targetFormat === "wav") {
        const wavBlob = audioBufferToWav(renderedBuffer)
        resolve(wavBlob)
      } else if (targetFormat === "mp3") {
        const mp3Blob = await audioBufferToMp3(renderedBuffer)
        resolve(mp3Blob)
      } else {
        const wavBlob = audioBufferToWav(renderedBuffer)
        resolve(wavBlob)
      }
    } catch (error) {
      reject(error)
    }
  })
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numberOfChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const format = 1
  const bitDepth = 16

  const bytesPerSample = bitDepth / 8
  const blockAlign = numberOfChannels * bytesPerSample

  const data = new Float32Array(buffer.length * numberOfChannels)

  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = buffer.getChannelData(channel)[i]
      data[i * numberOfChannels + channel] = sample
    }
  }

  const dataLength = data.length * bytesPerSample
  const bufferLength = 44 + dataLength
  const arrayBuffer = new ArrayBuffer(bufferLength)
  const view = new DataView(arrayBuffer)

  let offset = 0

  const writeString = (str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset++, str.charCodeAt(i))
    }
  }

  const writeUint32 = (value: number) => {
    view.setUint32(offset, value, true)
    offset += 4
  }

  const writeUint16 = (value: number) => {
    view.setUint16(offset, value, true)
    offset += 2
  }

  writeString("RIFF")
  writeUint32(bufferLength - 8)
  writeString("WAVE")
  writeString("fmt ")
  writeUint32(16)
  writeUint16(format)
  writeUint16(numberOfChannels)
  writeUint32(sampleRate)
  writeUint32(sampleRate * blockAlign)
  writeUint16(blockAlign)
  writeUint16(bitDepth)
  writeString("data")
  writeUint32(dataLength)

  for (let i = 0; i < data.length; i++) {
    const sample = Math.max(-1, Math.min(1, data[i]))
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff
    view.setInt16(offset, intSample, true)
    offset += 2
  }

  return new Blob([arrayBuffer], { type: "audio/wav" })
}

// Uses browser's native MP3 encoder via MediaRecorder
async function audioBufferToMp3(buffer: AudioBuffer): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const audioContext = new AudioContext()
      const source = audioContext.createBufferSource()
      source.buffer = buffer

      const destination = audioContext.createMediaStreamDestination()
      source.connect(destination)

      const mimeType = "audio/mpeg"
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        resolve(audioBufferToWav(buffer))
        return
      }

      const mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType: mimeType,
        audioBitsPerSecond: 192000,
      })

      const chunks: Blob[] = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const mp3Blob = new Blob(chunks, { type: "audio/mpeg" })
        resolve(mp3Blob)
      }

      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event)
        reject(new Error("Failed to encode MP3 using MediaRecorder"))
      }

      mediaRecorder.start()
      source.start(0)

      setTimeout(
        () => {
          mediaRecorder.stop()
          source.stop()
          audioContext.close()
        },
        (buffer.duration + 0.1) * 1000,
      )
    } catch (error) {
      console.error("MP3 encoding error:", error)
      reject(error)
    }
  })
}

// Fallback for when FFmpeg isn't available
async function extractAudioWithBrowserAPI(
  file: File,
  targetFormat: "mp3" | "wav" | "ogg" | "aac" | "flac" | "m4a",
): Promise<Blob> {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const arrayBuffer = await file.arrayBuffer()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    if (targetFormat === "mp3") {
      return await audioBufferToMp3(audioBuffer)
    } else if (targetFormat === "wav") {
      return audioBufferToWav(audioBuffer)
    } else {
      throw new Error(
        `${targetFormat.toUpperCase()} format requires FFmpeg.wasm in production. Try MP3 or WAV format instead.`,
      )
    }
  } catch (error) {
    console.error("Browser API audio extraction failed:", error)
    throw error
  }
}

export async function extractAudioFromVideo(
  file: File,
  targetFormat: "mp3" | "wav" | "ogg" | "aac" | "flac" | "m4a",
): Promise<Blob> {
  try {
    const ffmpeg = await getFFmpeg()

    const inputExt = file.name.split(".").pop() || "mp4"
    const inputFileName = `input.${inputExt}`
    const outputFileName = `output.${targetFormat}`

    await ffmpeg.writeFile(inputFileName, await fetchFile(file))

    let ffmpegArgs: string[] = []

    switch (targetFormat) {
      case "mp3":
        ffmpegArgs = ["-i", inputFileName, "-vn", "-acodec", "libmp3lame", "-b:a", "192k", outputFileName]
        break
      case "wav":
        ffmpegArgs = ["-i", inputFileName, "-vn", "-acodec", "pcm_s16le", "-ar", "44100", outputFileName]
        break
      case "ogg":
        ffmpegArgs = ["-i", inputFileName, "-vn", "-acodec", "libvorbis", "-b:a", "192k", outputFileName]
        break
      case "aac":
        ffmpegArgs = ["-i", inputFileName, "-vn", "-acodec", "aac", "-b:a", "192k", outputFileName]
        break
      case "flac":
        ffmpegArgs = ["-i", inputFileName, "-vn", "-acodec", "flac", outputFileName]
        break
      case "m4a":
        ffmpegArgs = ["-i", inputFileName, "-vn", "-acodec", "aac", "-b:a", "192k", outputFileName]
        break
      default:
        ffmpegArgs = ["-i", inputFileName, "-vn", "-acodec", "libmp3lame", "-b:a", "192k", outputFileName]
    }

    await ffmpeg.exec(ffmpegArgs)

    const data = await ffmpeg.readFile(outputFileName)

    await ffmpeg.deleteFile(inputFileName)
    await ffmpeg.deleteFile(outputFileName)

    const mimeTypes: Record<string, string> = {
      mp3: "audio/mpeg",
      wav: "audio/wav",
      ogg: "audio/ogg",
      aac: "audio/aac",
      flac: "audio/flac",
      m4a: "audio/mp4",
    }

    const mimeType = mimeTypes[targetFormat] || "audio/mpeg"
    const blob = new Blob([data], { type: mimeType })

    return blob
  } catch (error) {
    // Try browser fallback for MP3/WAV
    if (targetFormat === "mp3" || targetFormat === "wav") {
      try {
        return await extractAudioWithBrowserAPI(file, targetFormat)
      } catch (fallbackError) {
        console.error("Browser API fallback failed:", fallbackError)
        throw new Error(
          `Unable to convert video to ${targetFormat.toUpperCase()}. ${fallbackError instanceof Error ? fallbackError.message : "Please try again."}`,
        )
      }
    }

    throw new Error(
      `${targetFormat.toUpperCase()} conversion requires FFmpeg.wasm in production. ` +
        `Try converting to MP3 or WAV format instead, which work in all environments.`,
    )
  }
}

export async function convertVideo(
  file: File,
  targetFormat: "mp4" | "webm" | "avi" | "mov" | "mkv" | "flv",
): Promise<Blob> {
  try {
    const ffmpeg = await getFFmpeg()

    const inputExt = file.name.split(".").pop() || "mp4"
    const inputFileName = `input.${inputExt}`
    const outputFileName = `output.${targetFormat}`

    await ffmpeg.writeFile(inputFileName, await fetchFile(file))

    let ffmpegArgs: string[] = []

    switch (targetFormat) {
      case "mp4":
        ffmpegArgs = [
          "-i",
          inputFileName,
          "-c:v",
          "libx264",
          "-preset",
          "medium",
          "-crf",
          "23",
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          outputFileName,
        ]
        break
      case "webm":
        ffmpegArgs = [
          "-i",
          inputFileName,
          "-c:v",
          "libvpx-vp9",
          "-crf",
          "30",
          "-b:v",
          "0",
          "-c:a",
          "libopus",
          "-b:a",
          "128k",
          outputFileName,
        ]
        break
      case "avi":
        ffmpegArgs = ["-i", inputFileName, "-c:v", "mpeg4", "-q:v", "5", "-c:a", "mp3", "-b:a", "128k", outputFileName]
        break
      case "mov":
        ffmpegArgs = [
          "-i",
          inputFileName,
          "-c:v",
          "libx264",
          "-preset",
          "medium",
          "-crf",
          "23",
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          outputFileName,
        ]
        break
      case "mkv":
        ffmpegArgs = [
          "-i",
          inputFileName,
          "-c:v",
          "libx264",
          "-preset",
          "medium",
          "-crf",
          "23",
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          outputFileName,
        ]
        break
      case "flv":
        ffmpegArgs = ["-i", inputFileName, "-c:v", "flv", "-c:a", "mp3", "-b:a", "128k", outputFileName]
        break
      default:
        ffmpegArgs = ["-i", inputFileName, "-c", "copy", outputFileName]
    }

    await ffmpeg.exec(ffmpegArgs)

    const data = await ffmpeg.readFile(outputFileName)

    await ffmpeg.deleteFile(inputFileName)
    await ffmpeg.deleteFile(outputFileName)

    const mimeTypes: Record<string, string> = {
      mp4: "video/mp4",
      webm: "video/webm",
      avi: "video/x-msvideo",
      mov: "video/quicktime",
      mkv: "video/x-matroska",
      flv: "video/x-flv",
    }

    const mimeType = mimeTypes[targetFormat] || "video/mp4"
    const blob = new Blob([data], { type: mimeType })

    return blob
  } catch (error) {
    console.error("Video conversion error:", error)
    throw new Error(`Failed to convert video: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

let ffmpegInstance: FFmpeg | null = null
let ffmpegLoaded = false

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegLoaded) {
    return ffmpegInstance
  }

  if (!ffmpegInstance) {
    ffmpegInstance = new FFmpeg()

    ffmpegInstance.on("log", ({ message }) => {
      console.log("FFmpeg:", message)
    })

    ffmpegInstance.on("progress", ({ progress, time }) => {
      console.log(`FFmpeg progress: ${(progress * 100).toFixed(2)}% (time: ${time}s)`)
    })
  }

  if (!ffmpegLoaded) {
    if (typeof SharedArrayBuffer === "undefined") {
      throw new Error(
        "SharedArrayBuffer is not available. FFmpeg.wasm requires cross-origin isolation. " +
          "This is automatically enabled in production deployments.",
      )
    }

    const baseURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm"

    try {
      await ffmpegInstance.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      })
      ffmpegLoaded = true
    } catch (error) {
      console.error("Failed to load FFmpeg.wasm:", error)
      throw new Error(
        "Failed to load FFmpeg.wasm. This feature requires cross-origin isolation and works automatically in production.",
      )
    }
  }

  return ffmpegInstance
}
