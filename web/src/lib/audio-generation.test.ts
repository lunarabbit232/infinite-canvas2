import { describe, it, expect } from "vitest"
import {
  normalizeAudioVoiceValue,
  normalizeAudioFormatValue,
  normalizeAudioSpeedValue,
  audioVoiceLabel,
  audioFormatLabel,
  audioSpeedLabel,
  audioMimeType,
  audioVoiceOptions,
  cosyVoiceOptions,
} from "./audio-generation"

describe("normalizeAudioVoiceValue", () => {
  it("returns valid voice unchanged", () => {
    expect(normalizeAudioVoiceValue("alloy")).toBe("alloy")
    expect(normalizeAudioVoiceValue("nova")).toBe("nova")
    expect(normalizeAudioVoiceValue("cedar")).toBe("cedar")
  })

  // 音色取值不再走白名单：渠道各家音色命名不同（如硅基流动要求
  // "模型名:音色名"，克隆音色为 speech:xxx uri），白名单会把它们静默
  // 改写成 alloy 导致上游报错，故改为非空即放行。
  it("passes through voice names with model prefix", () => {
    expect(normalizeAudioVoiceValue("FunAudioLLM/CosyVoice2-0.5B:alex")).toBe(
      "FunAudioLLM/CosyVoice2-0.5B:alex",
    )
  })

  it("passes through custom cloned voice uri", () => {
    expect(normalizeAudioVoiceValue("speech:my-voice:abc:def")).toBe("speech:my-voice:abc:def")
  })

  it("passes through unknown voice instead of rewriting it", () => {
    expect(normalizeAudioVoiceValue("unknown")).toBe("unknown")
  })

  it("trims surrounding whitespace", () => {
    expect(normalizeAudioVoiceValue("  nova  ")).toBe("nova")
  })

  it("falls back to the first option for empty input", () => {
    expect(normalizeAudioVoiceValue("")).toBe(audioVoiceOptions[0].value)
    expect(normalizeAudioVoiceValue("   ")).toBe(audioVoiceOptions[0].value)
  })
})

describe("cosyVoiceOptions", () => {
  it("exposes the 8 preset Chinese voices", () => {
    expect(cosyVoiceOptions).toHaveLength(8)
  })

  it("prefixes every value with the model name", () => {
    for (const item of cosyVoiceOptions) {
      expect(item.value.startsWith("FunAudioLLM/CosyVoice2-0.5B:")).toBe(true)
    }
  })

  it("is included at the head of audioVoiceOptions", () => {
    expect(audioVoiceOptions.slice(0, 8)).toEqual(cosyVoiceOptions)
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

  it("returns the Chinese label for preset CosyVoice voices", () => {
    expect(audioVoiceLabel("FunAudioLLM/CosyVoice2-0.5B:claire")).toContain("温柔女声")
  })

  // 音色已不再走白名单，未收录的取值（自定义/克隆音色）原样作为标签展示，
  // 而非伪装成 Alloy。
  it("shows the raw value when no label is registered", () => {
    expect(audioVoiceLabel("bad")).toBe("bad")
    expect(audioVoiceLabel("speech:my-voice:abc:def")).toBe("speech:my-voice:abc:def")
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
