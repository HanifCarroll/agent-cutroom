import { describe, expect, it } from "vitest";
import { buildSubjectMaskFilter } from "../src/core/color-grade.js";

describe("buildSubjectMaskFilter", () => {
  it("builds a feathered subject-mask shadow lift filter", () => {
    const result = buildSubjectMaskFilter({
      media: {
        width: 2160,
        height: 3840,
        fps: 60,
        durationMs: 10_000,
      },
    });

    expect(result.filterGraph).toContain("[0:v]format=yuv444p,split=2[base][grade]");
    expect(result.filterGraph).toContain("eq=brightness=0.055:contrast=1.03:gamma=1.5:gamma_weight=0.8:saturation=1.06");
    expect(result.filterGraph).toContain("geq=lum='if(lte(pow((X-1080)/700,2)+pow((Y-1498)/1402,2),1),255,0)'");
    expect(result.filterGraph).toContain("gblur=sigma=90[mask]");
    expect(result.filterGraph).toContain("[base][lit][mask]maskedmerge[outv]");
  });
});
