import { describe, it, expect } from "vitest"
import {
  isSeedanceVideoModel,
  isSeedanceFastOrMiniModel,
  isArkPlanBaseUrl,
  normalizeResolutionToken,
  normalizeSeedanceResolution,
  normalizeSeedanceDuration,
  normalizeSeedanceRatio,
  seedancePixelLabel,
  boolConfig,
  seedanceReferenceLabel,
  buildSeedancePromptText,
  seedanceVideoReferenceError,
} from "./seedance-video"

describe("isSeedanceVideoModel", () => {
  it("detects seedance models", () => {
    expect(isSeedanceVideoModel("doubao-seedance-1.0-pro")).toBe(true)
    expect(isSeedanceVideoModel("SEEDANCE")).toBe(true)
  })

  it("returns false for non-seedance", () => {
    expect(isSeedanceVideoModel("kling-v2")).toBe(false)
  })
})

describe("isSeedanceFastOrMiniModel", () => {
  it("detects fast model", () => {
    expect(isSeedanceFastOrMiniModel("doubao-seedance-fast")).toBe(true)
  })

  it("detects mini model", () => {
    expect(isSeedanceFastOrMiniModel("seedance-mini")).toBe(true)
  })

  it("returns false for pro model", () => {
    expect(isSeedanceFastOrMiniModel("doubao-seedance-1.0-pro")).toBe(false)
  })
})

describe("isArkPlanBaseUrl", () => {
  it("detects ark plan URLs", () => {
    expect(isArkPlanBaseUrl("https://ark.cn-beijing.volces.com/api/plan/v3")).toBe(true)
  })

  it("works case-insensitively", () => {
    expect(isArkPlanBaseUrl("HTTPS://ARK.CN-BEIJING.VOLCES.COM/API/PLAN/V3")).toBe(true)
  })

  it("returns false for other URLs", () => {
    expect(isArkPlanBaseUrl("https://api.openai.com")).toBe(false)
  })
})

describe("normalizeResolutionToken", () => {
  it("maps low to 480p", () => {
    expect(normalizeResolutionToken("low")).toBe("480p")
  })

  it("maps auto/high/medium to 720p", () => {
    expect(normalizeResolutionToken("auto")).toBe("720p")
    expect(normalizeResolutionToken("high")).toBe("720p")
    expect(normalizeResolutionToken("medium")).toBe("720p")
  })

  it("strips trailing p and reappends", () => {
    expect(normalizeResolutionToken("1080p")).toBe("1080p")
    expect(normalizeResolutionToken("4K")).toBe("4Kp")
  })

  it("defaults empty to 720p", () => {
    expect(normalizeResolutionToken("")).toBe("720p")
  })
})

describe("normalizeSeedanceResolution", () => {
  it("caps 1080p to 720p for fast/mini models", () => {
    expect(normalizeSeedanceResolution("1080p", "seedance-fast")).toBe("720p")
  })

  it("allows 1080p for pro models", () => {
    expect(normalizeSeedanceResolution("1080p", "doubao-seedance-1.0-pro")).toBe("1080p")
  })

  it("defaults to 720p for invalid values", () => {
    expect(normalizeSeedanceResolution("999p")).toBe("720p")
  })
})

describe("normalizeSeedanceDuration", () => {
  it("returns -1 for special value", () => {
    expect(normalizeSeedanceDuration("-1")).toBe(-1)
    expect(normalizeSeedanceDuration(" -1 ")).toBe(-1)
  })

  it("clamps below 4 to 4", () => {
    expect(normalizeSeedanceDuration("1")).toBe(4)
    expect(normalizeSeedanceDuration("3")).toBe(4)
  })

  it("clamps above 15 to 15", () => {
    expect(normalizeSeedanceDuration("20")).toBe(15)
    expect(normalizeSeedanceDuration("100")).toBe(15)
  })

  it("defaults to 5 for non-numeric", () => {
    expect(normalizeSeedanceDuration("abc")).toBe(5)
  })
})

describe("normalizeSeedanceRatio", () => {
  it("returns adaptive for empty/auto/adaptive", () => {
    expect(normalizeSeedanceRatio("")).toBe("adaptive")
    expect(normalizeSeedanceRatio("auto")).toBe("adaptive")
    expect(normalizeSeedanceRatio("adaptive")).toBe("adaptive")
  })

  it("returns known ratios unchanged", () => {
    expect(normalizeSeedanceRatio("16:9")).toBe("16:9")
    expect(normalizeSeedanceRatio("9:16")).toBe("9:16")
    expect(normalizeSeedanceRatio("1:1")).toBe("1:1")
  })

  it("snaps dimension strings to nearest ratio", () => {
    expect(normalizeSeedanceRatio("1920x1080")).toBe("16:9")
    expect(normalizeSeedanceRatio("1080x1920")).toBe("9:16")
  })

  it("returns adaptive for invalid input", () => {
    expect(normalizeSeedanceRatio("foo")).toBe("adaptive")
  })
})

describe("seedancePixelLabel", () => {
  it("returns resolution for adaptive ratio", () => {
    expect(seedancePixelLabel("480p", "adaptive")).toBe("自动匹配")
  })

  it("returns pixel string for known combo", () => {
    expect(seedancePixelLabel("720p", "16:9")).toBe("1280x720")
    expect(seedancePixelLabel("1080p", "1:1")).toBe("1440x1440")
  })
})

describe("boolConfig", () => {
  it("parses true/false strings", () => {
    expect(boolConfig("true", false)).toBe(true)
    expect(boolConfig("false", true)).toBe(false)
  })

  it("returns fallback for other values", () => {
    expect(boolConfig(undefined, true)).toBe(true)
    expect(boolConfig("", false)).toBe(false)
    expect(boolConfig("yes", true)).toBe(true)
  })
})

describe("seedanceReferenceLabel", () => {
  it("labels by kind with 1-based index", () => {
    expect(seedanceReferenceLabel("image", 0)).toBe("图片1")
    expect(seedanceReferenceLabel("image", 1)).toBe("图片2")
    expect(seedanceReferenceLabel("video", 0)).toBe("视频1")
    expect(seedanceReferenceLabel("audio", 2)).toBe("音频3")
  })
})

describe("buildSeedancePromptText", () => {
  const img = { url: "x.jpg", name: "x" } as any
  const vid = { url: "a.mp4", name: "a" } as any

  it("prepends reference labels", () => {
    const result = buildSeedancePromptText("a cat", [img], [], [])
    expect(result).toContain("参考素材编号：图片1")
    expect(result).toContain("a cat")
  })

  it("returns prompt unchanged when no references", () => {
    expect(buildSeedancePromptText("a cat", [], [], [])).toBe("a cat")
  })
})

describe("seedanceVideoReferenceError", () => {
  it("returns empty for valid video", () => {
    expect(
      seedanceVideoReferenceError([
        { durationMs: 5000, width: 1280, height: 720, bytes: 1024 * 1024, url: "" },
      ] as any)
    ).toBe("")
  })

  it("reports oversized video", () => {
    expect(
      seedanceVideoReferenceError([
        { bytes: 51 * 1024 * 1024, url: "" },
      ] as any)
    ).toContain("超过 50MB")
  })

  it("reports duration out of range", () => {
    expect(
      seedanceVideoReferenceError([
        { durationMs: 1000, url: "" },
      ] as any)
    ).toContain("2-15 秒")
  })

  it("reports dimension out of range", () => {
    expect(
      seedanceVideoReferenceError([
        { width: 100, height: 100, durationMs: 5000, url: "" },
      ] as any)
    ).toContain("宽高需要在 300-6000px")
  })
})
