import {
  HANIF_CONTENT_PROFILE,
  TALKING_HEAD_STORY_RECIPE,
  buildContentPackage,
  readStoryCandidates,
  writeContentPackage,
  type BuildContentPackageOptions,
  type ContentPackage,
  type StoryCandidate,
  type StoryCandidates,
  type WriteContentPackageOptions,
} from "./content-package/index.js";

export type HanifStoryCandidate = StoryCandidate;
export type HanifStoryCandidates = StoryCandidates;
export type HanifContentPackage = ContentPackage;

export interface BuildHanifContentPackageOptions
  extends Omit<BuildContentPackageOptions, "recipe" | "profile"> {}

export interface WriteHanifContentPackageOptions
  extends Omit<WriteContentPackageOptions, "recipe" | "profile"> {}

export function buildHanifContentPackage(options: BuildHanifContentPackageOptions): HanifContentPackage {
  return buildContentPackage({
    ...options,
    recipe: TALKING_HEAD_STORY_RECIPE,
    profile: HANIF_CONTENT_PROFILE,
  });
}

export async function writeHanifContentPackage(
  options: WriteHanifContentPackageOptions,
): Promise<HanifContentPackage> {
  return writeContentPackage({
    ...options,
    recipe: TALKING_HEAD_STORY_RECIPE,
    profile: HANIF_CONTENT_PROFILE,
  });
}

export async function readHanifStoryCandidates(projectDir: string): Promise<HanifStoryCandidates | null> {
  return readStoryCandidates(projectDir);
}
