import { useMemo } from "react";
import { PREFABS, FACTIONS } from "@workspace/game-content";
import { applyCanonicalLoadoutToRoster, useMeta } from "../../game/metaProgression";
import { useRoster } from "../../game/roster";
import { CharacterCard } from "./CharacterCard";
import "./collection.css";

export function StarterPick() {
  const onboardingDone = useMeta((s) => s.onboardingDone);
  const completeStarterPick = useMeta((s) => s.completeStarterPick);
  const setPrefab = useRoster((s) => s.setPrefab);
  const setFaction = useRoster((s) => s.setFaction);
  const setMelee = useRoster((s) => s.setMelee);
  const setRanged = useRoster((s) => s.setRanged);
  const setGearTier = useRoster((s) => s.setGearTier);
  const seedDefaultLaneGuards = useMeta((s) => s.seedDefaultLaneGuards);

  const byFaction = useMemo(
    () =>
      FACTIONS.map((f) => ({
        faction: f,
        prefabs: PREFABS.filter((p) => p.faction === f.id),
      })),
    [],
  );

  if (onboardingDone) return null;

  const pick = (prefabId: string) => {
    const p = PREFABS.find((x) => x.id === prefabId);
    if (!p) return;
    completeStarterPick(prefabId);
    setFaction(p.faction);
    setPrefab(prefabId);
    applyCanonicalLoadoutToRoster(prefabId, setMelee, setRanged, setGearTier);
    seedDefaultLaneGuards(p.faction);
  };

  return (
    <div className="gw-starter-overlay">
      <div className="gw-starter-panel">
        <span className="gw-starter-kicker">GRUDGE6 · Bip001 · Full mesh</span>
        <h1 className="gw-starter-title">Choose Your Champion</h1>
        <p className="gw-starter-sub">
          Pick one warlord to begin your campaign. They arrive fully textured with canonical
          hidden/active mesh presets (same as the character viewer). Upgrade with cards, GBUX,
          and daily packs — collect 10 shards to unlock more lane guards and roster heroes.
        </p>
        {byFaction.map(({ faction, prefabs }) => (
          <section key={faction.id} className="gw-starter-faction">
            <h2 className="gw-starter-faction-name" style={{ color: faction.color }}>
              {faction.name}
            </h2>
            <div className="gw-starter-grid">
              {prefabs.map((p) => (
                <CharacterCard key={p.id} prefab={p} compact onSelect={() => pick(p.id)} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}