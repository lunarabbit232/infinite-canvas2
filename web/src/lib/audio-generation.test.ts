import { describe, it, expect } from "vitest"
import {
  normalizeAudioVoiceValue,
  normalizeAudioFormatValue,
  normalizeAudioSpeedValue,
  audioVoiceLabel,
  audioFormatLabel,
  audioSpeedLabel,
  audioMimeType,
} from "./audio-generation"

describe("normalizeAudioVoiceValue", () => {
  it("returns valid voice unchanged", () => {
    expect(normalizeAudioVoiceValue("alloy")).toBe("alloy")
    expect(normalizeAudioVoiceValue("nova")).toBe("nova")
    expect(normalizeAudioVoiceValue("cedar")).toBe("cedar")
  })

  it("returns alloy for unknown voice", () => {
    expect(normalizeAudioVoiceValue("unknown")).toBe("alloy")
  })

  it("returns alloy for empty string", () => {
    expect(normalizeAudioVoiceValue("")).toBe("alloy")
  })
})

describe("normalizeAudioFormatValue", () => {
  it("returns valid format unchanged", () => {
    expect(normalizeAudioFormatValue("mp3")).toBe("mp3")
    expect(normalizeAudioFormatValue("wav")).toBe("wav")
    expect(normalizeAudioFormatValue("flac")).toBe("flac")
  })

  it("returns mp3 for unknown format", () => {
    expect(normalizeAudioFormatValue("ogg")).toBe("mp3")
  })

  it("returns mp3 for empty string", () => {
    expect(normalizeAudioFormatValue("")).toBe("mp3")
  })
})

describe("normalizeAudioSpeedValue", () => {
  it("returns valid speed unchanged", () => {
    expect(normalizeAudioSpeedValue("1")).toBe("1")
    expect(normalizeAudioSpeedValue("2.5")).toBe("2.5")
  })

  it("clamps below 0.25", () => {
    expect(normalizeAudioSpeedValue("0")).toBe("0.25")
    expect(normalizeAudioSpeedValue("0.1")).toBe("0.25")
  })

  it("clamps above 4", () => {
    expect(normalizeAudioSpeedValue("5")).toBe("4")
    expect(normalizeAudioSpeedValue("10")).toBe("4")
  })

  it("returns 1 for non-finite input", () => {
    expect(normalizeAudioSpeedValue("abc")).toBe("1")
  })

  it("clamps empty string to 0.25", () => {
    expect(normalizeAudioSpeedValue("")).toBe("0.25")
  })
})

describe("audioVoiceLabel", () => {
  it("returns label for valid voice", () => {
    expect(audioVoiceLabel("nova")).toBe("Nova")
    expect(audioVoiceLabel("onyx")).toBe("Onyx")
  })

  it("falls back to alloy label for invalid", () => {
    expect(audioVoiceLabel("bad")).toBe("Alloy")
  })
})

describe("audioFormatLabel", () => {
  it("returns label for valid format", () => {
    expect(audioFormatLabel("mp3")).toBe("MP3")
    expect(audioFormatLabel("flac")).toBe("FLAC")
  })

  it("falls back to mp3 label for invalid", () => {
    expect(audioFormatLabel("bad")).toBe("MP3")
  })
})

describe("audioSpeedLabel", () => {
  it("formats speed with x suffix", () => {
    expect(audioSpeedLabel("1")).toBe("1x")
    expect(audioSpeedLabel("2")).toBe("2x")
  })
})

describe("audioMimeType", () => {
  it("returns correct mime type for each format", () => {
    expect(audioMimeType("mp3")).toBe("audio/mpeg")
    expect(audioMimeType("wav")).toBe("audio/wav")
    expect(audioMimeType("opus")).toBe("audio/opus")
    expect(audioMimeType("aac")).toBe("audio/aac")
    expect(audioMimeType("flac")).toBe("audio/flac")
    expect(audioMimeType("pcm")).toBe("audio/pcm")
  })

  it("defaults to audio/mpeg for unknown", () => {
    expect(audioMimeType("ogg")).toBe("audio/mpeg")
  })
})
