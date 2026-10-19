import type { AudioCodec } from 'mediabunny'
import { AudioBufferSource, BufferTarget, CanvasSource, canEncodeVideo, getFirstEncodableAudioCodec, Mp4OutputFormat, Output, QUALITY_HIGH } from 'mediabunny'
import { FPS } from '#shared/video'

// PUB-36·38: 브라우저 WebCodecs로 프레임을 H.264로 인코딩해 MP4로 묶는다. 음악은 AAC, 안 되면 Opus
export interface Music { blob: Blob, volume: number, fadeOutMs: number, loop: boolean }
const SAMPLE_RATE = 48_000

export async function canExportMp4(W: number, H: number) {
  if (typeof VideoEncoder === 'undefined') return false
  return canEncodeVideo('avc', { width: W, height: H }).catch(() => false)
}

/** 음원을 영상 길이에 맞춰 렌더링: 음량, 반복 또는 한 번, 끝부분 페이드 아웃 */
async function mixMusic(m: Music, totalMs: number) {
  const end = totalMs / 1000
  const ac = new OfflineAudioContext(2, Math.ceil(end * SAMPLE_RATE), SAMPLE_RATE)
  const buf = await ac.decodeAudioData(await m.blob.arrayBuffer())
  const src = ac.createBufferSource()
  src.buffer = buf
  src.loop = m.loop
  const gain = ac.createGain()
  const stop = m.loop ? end : Math.min(end, buf.duration)
  const fade = Math.min(m.fadeOutMs / 1000, stop)
  gain.gain.setValueAtTime(m.volume, 0)
  if (fade > 0) {
    gain.gain.setValueAtTime(m.volume, stop - fade)
    gain.gain.linearRampToValueAtTime(0, stop)
  }
  src.connect(gain).connect(ac.destination)
  src.start(0)
  return ac.startRendering()
}

export interface EncodeInput {
  W: number
  H: number
  totalMs: number
  draw: (ctx: CanvasRenderingContext2D, t: number) => void
  music: Music | null
  onProgress: (ratio: number) => void
  signal?: AbortSignal
}

export async function encodeMp4(o: EncodeInput): Promise<{ blob: Blob, audio: AudioCodec | null }> {
  const cv = document.createElement('canvas')
  cv.width = o.W
  cv.height = o.H
  const ctx = cv.getContext('2d')!
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() })
  const video = new CanvasSource(cv, { codec: 'avc', bitrate: QUALITY_HIGH, keyFrameInterval: 2 })
  output.addVideoTrack(video, { frameRate: FPS })
  let audioCodec: AudioCodec | null = null
  let audio: { src: AudioBufferSource, buf: AudioBuffer } | null = null
  if (o.music) {
    const buf = await mixMusic(o.music, o.totalMs)
    audioCodec = await getFirstEncodableAudioCodec(['aac', 'opus'], { numberOfChannels: 2, sampleRate: SAMPLE_RATE })
    if (audioCodec) {
      audio = { src: new AudioBufferSource({ codec: audioCodec, bitrate: QUALITY_HIGH }), buf }
      output.addAudioTrack(audio.src)
    }
  }
  await output.start()
  try {
    const n = Math.max(1, Math.round(o.totalMs / 1000 * FPS))
    for (let i = 0; i < n; i++) {
      if (o.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      o.draw(ctx, i * 1000 / FPS)
      await video.add(i / FPS, 1 / FPS)
      o.onProgress((i + 1) / n)
    }
    video.close()
    if (audio) {
      await audio.src.add(audio.buf)
      audio.src.close()
    }
    await output.finalize()
  }
  catch (e) {
    await output.cancel().catch(() => {})
    throw e
  }
  return { blob: new Blob([output.target.buffer!], { type: 'video/mp4' }), audio: audioCodec }
}
