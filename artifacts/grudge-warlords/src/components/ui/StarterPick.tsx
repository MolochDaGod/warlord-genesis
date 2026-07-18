import { useMemo } from "react";
import { PREFABS, FACTIONS } from "@workspace/game-content";
import { applyCanonicalLoadoutToRoster, useMeta } from "../../game/metaProgression";
import { useRoster } from "../../game/roster";
import { CharacterCard } from "./CharacterCard";
import { isOpenLaunch } from "../../lib/openLaunch";
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

  // Open / charactersgrudox already chose the hero — never block with starter overlay
  if (onboardingDone || isOpenLaunch()) return null;

  const pick = (prefabId: string) => {
    const p = PREFABS.find((x) => x.id === prefabId);
    if (!p) {
      // Content pack missing — still clear overlay so warcamp is usable.
      completeStarterPick(prefabId);
      return;
    }
    completeStarterPick(prefabId);
    setFaction(p.faction);
    setPrefab(prefabId);
    applyCanonicalLoadoutToRoster(prefabId, setMelee, setRanged, setGearTier);
    seedDefaultLaneGuards(p.faction);
  };

  const totalCards = byFaction.reduce((n, x) => n + x.prefabs.length, 0);

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
        {totalCards === 0 ? (
          <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
            <p className="gw-starter-sub">Champion codex failed to load. Continue with the default warlord.</p>
            <button
              type="button"
              className="gw-btn"
              onClick={() => pick("sir-aldric-valorheart")}
            >
              Continue as Sir Aldric
            </button>
          </div>
        ) : (
          byFaction.map(({ faction, prefabs }) =>
            prefabs.length === 0 ? null : (
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
            ),
          )
        )}
      </div>
    </div>
  );
}