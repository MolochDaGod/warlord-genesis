import { codexEntryForPrefab, heroPortraitFallback, heroPortraitUrl } from "./heroCodex";
import manifest from "../../public/media/heroes/manifest.json";

export interface HeroMediaEntry {
  codexId: string;
  name: string;
  portrait: string;
  video: string | null;
}

const BY_CODEX = new Map<string, HeroMediaEntry>(
  (manifest.heroes as HeroMediaEntry[]).map((h) => [h.codexId, h]),
);

export function mediaForPrefab(prefabId: string): HeroMediaEntry | null {
  const entry = codexEntryForPrefab(prefabId);
  if (!entry) return null;
  return (
    BY_CODEX.get(entry.id) ?? {
      codexId: entry.id,
      name: entry.name,
      portrait: heroPortraitUrl(entry),
      video: null,
    }
  );
}

export function resolvePortraitUrl(prefabId: string): string {
  const media = mediaForPrefab(prefabId);
  if (media?.portrait) return media.portrait;
  const codex = codexEntryForPrefab(prefabId);
  if (codex) return heroPortraitUrl(codex);
  return "";
}

export function resolveVideoUrl(prefabId: string): string | null {
  return mediaForPrefab(prefabId)?.video ?? null;
}

export function portraitFallbackUrl(prefabId: string): string {
  const codex = codexEntryForPrefab(prefabId);
  return codex ? heroPortraitFallback(codex) : "";
}