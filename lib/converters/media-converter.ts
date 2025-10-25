import { FFmpeg } from "@ffmpeg/ffmpeg"
import { toBlobURL, fetchFile } from "@ffmpeg/util"

export async function convertAudio(
  file: File,
  targetFormat: "mp3" | "wav" | "ogg" | "aac" | "flac" | "m4a",
): Promise<Blob> {
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
        // Try to encode with MediaRecorder for other formats
        const encodedBlob = await encodeWithMediaRecorder(renderedBuffer, targetFormat as any)
        resolve(encodedBlob)
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
      // Check if browser supports MP3 encoding
      const supportedTypes = ["audio/mpeg", "audio/mp3", "audio/mpeg3", "audio/x-mpeg-3"]

      let supportedMimeType: string | null = null
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          supportedMimeType = type
          break
        }
      }

      // If no MP3 support, fall back to WAV
      if (!supportedMimeType) {
        console.warn("[v0] MP3 encoding not supported by browser, converting to WAV instead")
        resolve(audioBufferToWav(buffer))
        return
      }

      const audioContext = new AudioContext()
      const source = audioContext.createBufferSource()
      source.buffer = buffer

      const destination = audioContext.createMediaStreamDestination()
      source.connect(destination)

      const mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType: supportedMimeType,
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
        console.error("[v0] MediaRecorder error:", event)
        // Fall back to WAV on error
        resolve(audioBufferToWav(buffer))
      }

      mediaRecorder.start()
      source.start(0)

      setTimeout(
        () => {
          try {
            mediaRecorder.stop()
            source.stop()
            audioContext.close()
          } catch (e) {
            console.error("[v0] Error stopping MediaRecorder:", e)
          }
        },
        (buffer.duration + 0.1) * 1000,
      )
    } catch (error) {
      console.error("[v0] MP3 encoding error:", error)
      // Fall back to WAV
      resolve(audioBufferToWav(buffer))
    }
  })
}

async function extractAudioWithBrowserAPI(
  file: File,
  targetFormat: "mp3" | "wav" | "ogg" | "aac" | "flac" | "m4a",
): Promise<Blob> {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const arrayBuffer = await file.arrayBuffer()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    // Try to use MediaRecorder for various formats
    if (targetFormat === "mp3") {
      return await audioBufferToMp3(audioBuffer)
    } else if (targetFormat === "wav") {
      return audioBufferToWav(audioBuffer)
    } else if (targetFormat === "ogg" || targetFormat === "aac" || targetFormat === "m4a") {
      // Try MediaRecorder with the requested format
      return await encodeWithMediaRecorder(audioBuffer, targetFormat)
    } else {
      // Default to WAV for unsupported formats
      console.warn(`[v0] ${targetFormat.toUpperCase()} not supported, converting to WAV`)
      return audioBufferToWav(audioBuffer)
    }
  } catch (error) {
    console.error("[v0] Browser API audio extraction failed:", error)
    throw error
  }
}

async function encodeWithMediaRecorder(
  buffer: AudioBuffer,
  targetFormat: "ogg" | "aac" | "m4a" | "flac",
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const mimeTypeMap: Record<string, string[]> = {
        ogg: ["audio/ogg", "audio/ogg;codecs=opus"],
        aac: ["audio/aac", "audio/mp4", "audio/mp4;codecs=mp4a.40.2"],
        m4a: ["audio/mp4", "audio/mp4;codecs=mp4a.40.2", "audio/aac"],
        flac: ["audio/flac"],
      }

      const possibleTypes = mimeTypeMap[targetFormat] || []
      let supportedMimeType: string | null = null

      for (const type of possibleTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          supportedMimeType = type
          break
        }
      }

      // If format not supported, fall back to WAV
      if (!supportedMimeType) {
        console.warn(`[v0] ${targetFormat.toUpperCase()} encoding not supported by browser, converting to WAV instead`)
        resolve(audioBufferToWav(buffer))
        return
      }

      const audioContext = new AudioContext()
      const source = audioContext.createBufferSource()
      source.buffer = buffer

      const destination = audioContext.createMediaStreamDestination()
      source.connect(destination)

      const mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType: supportedMimeType,
        audioBitsPerSecond: 192000,
      })

      const chunks: Blob[] = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const outputBlob = new Blob(chunks, { type: supportedMimeType! })
        resolve(outputBlob)
      }

      mediaRecorder.onerror = (event) => {
        console.error(`[v0] MediaRecorder error for ${targetFormat}:`, event)
        // Fall back to WAV on error
        resolve(audioBufferToWav(buffer))
      }

      mediaRecorder.start()
      source.start(0)

      setTimeout(
        () => {
          try {
            mediaRecorder.stop()
            source.stop()
            audioContext.close()
          } catch (e) {
            console.error("[v0] Error stopping MediaRecorder:", e)
          }
        },
        (buffer.duration + 0.1) * 1000,
      )
    } catch (error) {
      console.error(`[v0] ${targetFormat.toUpperCase()} encoding error:`, error)
      // Fall back to WAV
      resolve(audioBufferToWav(buffer))
    }
  })
}

export async function extractAudioFromVideo(
  file: File,
  targetFormat: "mp3" | "wav" | "ogg" | "aac" | "flac" | "m4a",
): Promise<Blob> {
  // Try browser API first for better compatibility
  try {
    console.log(`[v0] Attempting browser-based audio extraction to ${targetFormat}`)
    return await extractAudioWithBrowserAPI(file, targetFormat)
  } catch (browserError) {
    console.warn("[v0] Browser API extraction failed, trying FFmpeg:", browserError)

    // Try FFmpeg as fallback
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
    } catch (ffmpegError) {
      console.error("[v0] FFmpeg extraction also failed:", ffmpegError)
      throw new Error(
        `Unable to extract audio from video. The browser API and FFmpeg both failed. ` +
          `This may be due to an unsupported video format or codec.`,
      )
    }
  }
}

export async function convertVideo(
  file: File,
  targetFormat: "mp4" | "webm" | "avi" | "mov" | "mkv" | "flv",
): Promise<Blob> {
  // Try browser-based conversion for WebM
  if (targetFormat === "webm") {
    try {
      console.log("[v0] Attempting browser-based video conversion to WebM")
      return await convertVideoWithBrowser(file, targetFormat)
    } catch (browserError) {
      console.warn("[v0] Browser conversion failed, trying FFmpeg:", browserError)
    }
  }

  // Use FFmpeg for all other formats or if browser conversion failed
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
    console.error("[v0] Video conversion error:", error)
    throw new Error(
      `Video conversion requires FFmpeg.wasm which needs cross-origin isolation. ` +
        `This works automatically in production deployments. ` +
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    )
  }
}

async function convertVideoWithBrowser(file: File, targetFormat: "webm"): Promise<Blob> {
  return new Promise(async (resolve, reject) => {
    try {
      const video = document.createElement("video")
      video.src = URL.createObjectURL(file)
      video.muted = true

      await new Promise((res, rej) => {
        video.onloadedmetadata = () => res(null)
        video.onerror = () => rej(new Error("Failed to load video"))
      })

      const canvas = document.createElement("canvas")
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext("2d")!

      const stream = canvas.captureStream(30)

      // Add audio track if available
      const audioContext = new AudioContext()
      const source = audioContext.createMediaElementSource(video)
      const destination = audioContext.createMediaStreamDestination()
      source.connect(destination)

      if (destination.stream.getAudioTracks().length > 0) {
        destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track))
      }

      const mimeType = "video/webm;codecs=vp9,opus"
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        throw new Error("WebM encoding not supported by browser")
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2500000,
      })

      const chunks: Blob[] = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const webmBlob = new Blob(chunks, { type: "video/webm" })
        URL.revokeObjectURL(video.src)
        resolve(webmBlob)
      }

      mediaRecorder.onerror = (event) => {
        console.error("[v0] MediaRecorder error:", event)
        URL.revokeObjectURL(video.src)
        reject(new Error("Failed to encode video"))
      }

      mediaRecorder.start()
      video.play()

      // Draw frames
      const drawFrame = () => {
        if (!video.paused && !video.ended) {
          ctx.drawImage(video, 0, 0)
          requestAnimationFrame(drawFrame)
        }
      }
      drawFrame()

      video.onended = () => {
        mediaRecorder.stop()
        audioContext.close()
      }
    } catch (error) {
      reject(error)
    }
  })
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
