import { describe, it, expect } from "vitest"
import { describeFocalLength, describeAperture, applyCameraPrompt } from "./canvas-camera"
import type { CameraControlOptions } from "../types"

describe("describeFocalLength", () => {
  it("describes ultra-wide (<=16mm)", () => {
    const result = describeFocalLength(14)
    expect(result).toContain("ultra-wide-angle")
    expect(result).toContain("14mm")
  })

  it("describes wide (17-24mm)", () => {
    const result = describeFocalLength(24)
    expect(result).toContain("wide-angle perspective")
    expect(result).toContain("24mm")
  })

  it("describes slight-wide (25-35mm)", () => {
    const result = describeFocalLength(35)
    expect(result).toContain("slight-wide cinematic")
    expect(result).toContain("35mm")
  })

  it("describes standard (36-50mm)", () => {
    const result = describeFocalLength(50)
    expect(result).toContain("standard/normal")
    expect(result).toContain("50mm")
  })

  it("describes short-telephoto (51-85mm)", () => {
    const result = describeFocalLength(85)
    expect(result).toContain("short-telephoto portrait")
    expect(result).toContain("85mm")
  })

  it("describes telephoto (86-135mm)", () => {
    const result = describeFocalLength(135)
    expect(result).toContain("telephoto perspective")
    expect(result).toContain("135mm")
  })

  it("describes long-telephoto (>135mm)", () => {
    const result = describeFocalLength(200)
    expect(result).toContain("long-telephoto")
    expect(result).toContain("200mm")
  })
})

describe("describeAperture", () => {
  it("describes extremely wide open (<=1.4)", () => {
    const result = describeAperture(1.2)
    expect(result).toContain("shot wide open")
    expect(result).toContain("f/1.2")
  })

  it("describes very shallow (1.5-2)", () => {
    const result = describeAperture(2)
    expect(result).toContain("very shallow")
    expect(result).toContain("f/2")
  })

  it("describes shallow (2.1-2.8)", () => {
    const result = describeAperture(2.8)
    expect(result).toContain("shallow depth of field")
    expect(result).toContain("f/2.8")
  })

  it("describes moderate (2.9-4)", () => {
    const result = describeAperture(4)
    expect(result).toContain("moderate depth")
    expect(result).toContain("f/4")
  })

  it("describes balanced (4.1-5.6)", () => {
    const result = describeAperture(5.6)
    expect(result).toContain("balanced depth")
    expect(result).toContain("f/5.6")
  })

  it("describes wide (5.7-8)", () => {
    const result = describeAperture(8)
    expect(result).toContain("wide depth of field")
    expect(result).toContain("f/8")
  })

  it("describes very wide (>8)", () => {
    const result = describeAperture(16)
    expect(result).toContain("very wide depth")
    expect(result).toContain("f/16")
  })
})

describe("applyCameraPrompt", () => {
  const control: CameraControlOptions = {
    enabled: true,
    camera: "arri_alexa_mini_lf",
    lens: "zeiss_supreme_prime",
    focalLength: 50,
    aperture: 2.8,
  }

  it("returns original prompt when disabled", () => {
    expect(applyCameraPrompt("a sunset", { ...control, enabled: false })).toBe("a sunset")
    expect(applyCameraPrompt("a sunset", undefined)).toBe("a sunset")
  })

  it("appends camera prompt to user prompt", () => {
    const result = applyCameraPrompt("a sunset", control)
    expect(result).toContain("a sunset")
    expect(result).toContain("ARRI Alexa Mini LF")
    expect(result).toContain("Zeiss Supreme Prime")
    expect(result).toContain("50mm")
    expect(result).toContain("f/2.8")
  })

  it("returns only camera prompt when no user prompt", () => {
    const result = applyCameraPrompt("", control)
    expect(result).toContain("camera direction")
    expect(result).toContain("ARRI Alexa Mini LF")
  })

  it("falls back to first camera/lens profile for unknown ids", () => {
    const result = applyCameraPrompt("test", {
      enabled: true,
      camera: "nonexistent",
      lens: "also_fake",
      focalLength: 35,
      aperture: 4,
    })
    expect(result).toContain("test")
    expect(result).toContain("Panavision DXL2")
    expect(result).toContain("ARRI Signature Prime")
  })
})
