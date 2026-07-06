import { describe, expect, it } from "vitest";
import { buildSubjectMaskFilter } from "../src/core/color-grade.js";

describe("buildSubjectMaskFilter", () => {
  it("builds a highlight-protected subject-mask shadow lift filter", () => {
    const result = buildSubjectMaskFilter({
      media: {
        width: 2160,
        height: 3840,
        fps: 60,
        durationMs: 10_000,
      },
    });

    expect(result.filterGraph).toContain("[0:v]format=yuv444p,split=3[base][grade][shadowSrc]");
    expect(result.filterGraph).toContain("eq=brightness=0.035:contrast=1.02:gamma=1.35:gamma_weight=0.76:saturation=1.04");
    expect(result.filterGraph).toContain("geq=lum='if(lte(pow((X-1080)/700,2)+pow((Y-1498)/1402,2),1),255,0)'");
    expect(result.filterGraph).toContain("[shadowSrc]format=gray,geq=lum='if(lte(lum(X,Y),95),255,if(gte(lum(X,Y),185),0,(185-lum(X,Y))*255/90))'");
    expect(result.filterGraph).toContain("[ellipseMask][shadowMask]blend=all_mode=multiply,gblur=sigma=8[mask]");
    expect(result.filterGraph).toContain("[base][lit][mask]maskedmerge[outv]");
  });
});
