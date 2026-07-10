import { useState } from "react";
import type { PrefabCharacter } from "@workspace/game-content";
import { GRUDGE_FACTION_BY_ID } from "../../engine/grudge6";
import { portraitFallbackUrl, resolvePortraitUrl, resolveVideoUrl } from "../../lib/heroMedia";
import { HeroVideoOverlay } from "./HeroVideoOverlay";
import { WarlordPreview } from "./WarlordPreview";

interface HeroShowcaseProps {
  prefab: PrefabCharacter;
  /** When true, prefer saved WebM over live 3D. */
  preferVideo?: boolean;
}

/** Default to live Bip001 mesh in warcamp; video is opt-in. */
export function HeroShowcase({ prefab, preferVideo = false }: HeroShowcaseProps) {
  const [videoFailed, setVideoFailed] = useState(false);
  const [portraitFailed, setPortraitFailed] = useState(false);
  const videoSrc = resolveVideoUrl(prefab.id);
  const portrait = resolvePortraitUrl(prefab.id);
  const fallback = portraitFallbackUrl(prefab.id);
  const faction = GRUDGE_FACTION_BY_ID[prefab.faction];
  const showVideo = preferVideo && videoSrc && !videoFailed;

  return (
    <div className="gw-hero-showcase" style={{ ["--showcase-accent" as string]: faction.color }}>
      {showVideo ? (
        <video
          className="gw-hero-showcase-video"
          src={videoSrc}
          autoPlay
          loop
          muted
          playsInline
          poster={portrait || fallback}
          onError={() => setVideoFailed(true)}
        />
      ) : (
        <>
          {!portraitFailed && (portrait || fallback) && (
            <img
              className="gw-hero-showcase-portrait"
              src={portraitFailed ? fallback : portrait || fallback}
              alt={prefab.name}
              onError={() => setPortraitFailed(true)}
            />
          )}
          <div className="gw-hero-showcase-3d">
            <WarlordPreview raceId={prefab.raceId} classId={prefab.classId} tint={faction.color} />
          </div>
        </>
      )}
      <div className="gw-hero-showcase-vignette" />
      <HeroVideoOverlay prefab={prefab} compact={!!showVideo} />
      <div className="gw-hero-showcase-badge">
        {showVideo ? "SHOWCASE REEL" : "LIVE BIP001 MESH"}
      </div>
    </div>
  );
}