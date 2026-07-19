/**
 * Post-faction warlord pick — only prefabs for the locked faction.
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PREFABS, FACTION_BY_ID } from "@workspace/game-content";
import { applyCanonicalLoadoutToRoster, useMeta } from "../game/metaProgression";
import { useRoster } from "../game/roster";
import { CharacterCard } from "../components/ui/CharacterCard";
import { PRODUCTION_SEASON_LABEL } from "../lib/productionSeason";
import "../components/ui/collection.css";

export function WarlordSelect() {
  const navigate = useNavigate();
  const factionId = useMeta((s) => s.factionId);
  const factionChosen = useMeta((s) => s.factionChosen);
  const onboardingDone = useMeta((s) => s.onboardingDone);
  const completeStarterPick = useMeta((s) => s.completeStarterPick);
  const setPrefab = useRoster((s) => s.setPrefab);
  const setMelee = useRoster((s) => s.setMelee);
  const setRanged = useRoster((s) => s.setRanged);
  const setGearTier = useRoster((s) => s.setGearTier);
  const seedDefaultLaneGuards = useMeta((s) => s.seedDefaultLaneGuards);

  if (!factionChosen || !factionId) {
    navigate("/onboarding/faction", { replace: true });
    return null;
  }
  if (onboardingDone) {
    navigate("/lobby", { replace: true });
    return null;
  }

  const faction = FACTION_BY_ID[factionId];
  const prefabs = useMemo(
    () => PREFABS.filter((p) => p.faction === factionId),
    [factionId],
  );

  const pick = (prefabId: string) => {
    const p = PREFABS.find((x) => x.id === prefabId);
    if (!p || p.faction !== factionId) return;
    completeStarterPick(prefabId);
    setPrefab(prefabId);
    applyCanonicalLoadoutToRoster(prefabId, setMelee, setRanged, setGearTier);
    seedDefaultLaneGuards(factionId);
    navigate("/lobby");
  };

  return (
    <div className="gw-starter-overlay" style={{ position: "relative", minHeight: "100vh" }}>
      <div className="gw-starter-panel">
        <span className="gw-starter-kicker">{PRODUCTION_SEASON_LABEL}</span>
        <h1 className="gw-starter-title" style={{ color: faction?.color }}>
          {faction?.name ?? "Faction"} Warlord
        </h1>
        <p className="gw-starter-sub">
          Pick your starting champion. They unlock at card level 3 with full campaign kit.
          Earn shards in matches and missions to unlock more {faction?.name} warlords and
          upgrade gear.
        </p>
        <div className="gw-starter-grid">
          {prefabs.map((p) => (
            <CharacterCard key={p.id} prefab={p} compact onSelect={() => pick(p.id)} />
          ))}
        </div>
        {prefabs.length === 0 && (
          <button type="button" className="gw-btn" onClick={() => pick("sir-aldric-valorheart")}>
            Continue with default
          </button>
        )}
      </div>
    </div>
  );
}
