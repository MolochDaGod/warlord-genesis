import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { PREFABS, CLASS_BY_ID } from "@workspace/game-content";
import {
  GRUDGE_FACTIONS,
  GRUDGE_FACTION_BY_ID,
  GRUDGE_PREFAB_BY_ID,
  gearPresetFor,
  resolveUnitDef,
} from "../../engine/grudge6";
import { factionMeleeIds, factionRangedIds } from "../../game/laneDeployment";
import { useMeta } from "../../game/metaProgression";
import { useGame } from "../../game/store";
import { useRoster } from "../../game/roster";
import { viewerUrl } from "../../lib/grudgeViewer";
import { WarlordPreview } from "./WarlordPreview";
import { Loadout } from "./Loadout";
import { PreMatchLaneDeploy } from "./PreMatchLaneDeploy";
import { CharacterCard, LaneGuardCard } from "./CharacterCard";
import { HeroDetailModal } from "./HeroDetailModal";
import "./characterSelect.css";

const CLASS_LABEL: Record<string, string> = {
  warrior: "Warrior",
  worge: "Worge",
  mage: "Mage",
  ranger: "Ranger",
};

const CLASS_ORDER = ["warrior", "worge", "mage", "ranger"] as const;

export function CharacterSelect() {
  const location = useLocation();
  const factionId = useRoster((s) => s.factionId);
  const raceId = useRoster((s) => s.raceId);
  const classId = useRoster((s) => s.classId);
  const prefabId = useRoster((s) => s.prefabId);
  const grudgeId = useRoster((s) => s.grudgeId);
  const setFaction = useRoster((s) => s.setFaction);
  const setPrefab = useRoster((s) => s.setPrefab);
  const setGrudgeHandoff = useRoster((s) => s.setGrudgeHandoff);
  const laneMeleeHeroId = useRoster((s) => s.laneMeleeHeroId);
  const laneRangedHeroId = useRoster((s) => s.laneRangedHeroId);
  const setLaneMeleeHero = useRoster((s) => s.setLaneMeleeHero);
  const setLaneRangedHero = useRoster((s) => s.setLaneRangedHero);
  const isCharacterUnlocked = useMeta((s) => s.isCharacterUnlocked);
  const isLaneGuardUnlocked = useMeta((s) => s.isLaneGuardUnlocked);
  const seedDefaultLaneGuards = useMeta((s) => s.seedDefaultLaneGuards);
  const resetLaneDeployment = useGame((s) => s.resetLaneDeployment);
  const [inspectId, setInspectId] = useState<string | null>(null);

  useEffect(() => {
    if (location.search) setGrudgeHandoff(location.search);
  }, [location.search, setGrudgeHandoff]);

  useEffect(() => {
    seedDefaultLaneGuards(factionId);
    resetLaneDeployment();
  }, [factionId, seedDefaultLaneGuards, resetLaneDeployment]);

  const faction = GRUDGE_FACTION_BY_ID[factionId];
  const prefab = GRUDGE_PREFAB_BY_ID[prefabId];
  const gear = gearPresetFor(raceId, classId);
  const cls = CLASS_BY_ID[classId];

  const factionPrefabs = useMemo(
    () =>
      PREFABS.filter((p) => p.faction === factionId).sort((a, b) => {
        const ra = faction.races.indexOf(a.raceId);
        const rb = faction.races.indexOf(b.raceId);
        if (ra !== rb) return ra - rb;
        return CLASS_ORDER.indexOf(a.classId) - CLASS_ORDER.indexOf(b.classId);
      }),
    [factionId, faction.races],
  );

  const meleeHeroOpts = useMemo(() => factionMeleeIds(factionId), [factionId]);
  const rangedHeroOpts = useMemo(() => factionRangedIds(factionId), [factionId]);

  const heroLabel = (typeId: string) => resolveUnitDef(typeId)?.name ?? typeId.replace(/_/g, " ");
  const inspectPrefab = inspectId
    ? PREFABS.find((p) => p.id === inspectId) ?? null
    : null;

  return (
    <div className="gw-cs gw-cs-v2">
      {inspectPrefab && (
        <HeroDetailModal
          prefab={inspectPrefab}
          onClose={() => setInspectId(null)}
          onSelect={
            isCharacterUnlocked(inspectPrefab.id)
              ? () => {
                  setPrefab(inspectPrefab.id);
                  setInspectId(null);
                }
              : undefined
          }
        />
      )}
      <header className="gw-cs-header">
        <div>
          <h2 className="gw-cs-heading">Choose Your Warlord</h2>
          <p className="gw-cs-sub">
            Unlocked champions only — collect 10 shards in the War Chest to recruit more. Canonical
            GRUDGE6 Bip001 meshes with hidden/active gear presets (D1-style).
          </p>
        </div>
        <div className="gw-cs-factions">
          {GRUDGE_FACTIONS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`gw-cs-faction${f.id === factionId ? " is-active" : ""}`}
              style={{ ["--cs-accent" as string]: f.color }}
              onClick={() => setFaction(f.id)}
            >
              <span className="gw-cs-faction-name">{f.name}</span>
              <span className="gw-cs-faction-motto">{f.motto}</span>
            </button>
          ))}
        </div>
      </header>

      <div className="gw-cs-body">
        <aside className="gw-cs-preview-col">
          <WarlordPreview raceId={raceId} classId={classId} tint={faction.color} />
          <div className="gw-cs-hero" style={{ ["--cs-accent" as string]: gear?.color ?? faction.color }}>
            <div className="gw-cs-hero-name">{prefab?.name ?? "Warlord"}</div>
            <div className="gw-cs-hero-title">{prefab?.title}</div>
            <div className="gw-cs-hero-meta">
              <span className="gw-cs-race">{raceId.replace(/-/g, " ")}</span>
              <span className="gw-cs-hero-class" style={{ color: cls.color }}>
                {CLASS_LABEL[classId] ?? classId}
              </span>
              <span className="gw-cs-mesh-pill">{gear?.label ?? "Gear"} · {gear?.visibleMeshes.length ?? 0} meshes</span>
            </div>
            <p className="gw-cs-hero-blurb">{prefab?.lore}</p>
            <div className="gw-cs-hero-actions">
              <button type="button" className="gw-cs-viewer-btn" onClick={() => setInspectId(prefabId)}>
                Hero Details + AI
              </button>
              <a
                className="gw-cs-viewer-btn"
                href={viewerUrl(raceId, classId)}
                target="_blank"
                rel="noreferrer"
              >
                Open in Viewer
              </a>
              <span className="gw-cs-grudge-id" title="Deterministic GRDG id">
                {grudgeId}
              </span>
            </div>
          </div>
        </aside>

        <section className="gw-cs-roster">
          <div className="gw-cs-label">YOUR ROSTER CARDS · {faction.name.toUpperCase()}</div>
          <div className="gw-cs-roster-grid gw-collection-grid">
            {factionPrefabs.map((p) => {
              const unlocked = isCharacterUnlocked(p.id);
              return (
                <CharacterCard
                  key={p.id}
                  prefab={p}
                  active={p.id === prefabId}
                  locked={!unlocked}
                  onSelect={unlocked ? () => setPrefab(p.id) : undefined}
                  onInspect={() => setInspectId(p.id)}
                />
              );
            })}
          </div>
        </section>
      </div>

      <section className="gw-cs-lane-guards">
        <div className="gw-cs-label">LANE GUARD CARDS (10 SHARDS TO UNLOCK)</div>
        <p className="gw-cs-lane-hint">
          One melee + one ranged GRUDGE6 hero marches all three lanes. Faction defaults are free;
          recruit alternates with shard drops from wins and daily packs.
        </p>
        <div className="gw-cs-lane-grid">
          <div className="gw-cs-lane-col">
            <span className="gw-cs-lane-col-title">Melee guard</span>
            {meleeHeroOpts.map((id) => {
              const unlocked = isLaneGuardUnlocked(id, factionId);
              return (
                <LaneGuardCard
                  key={id}
                  unitId={id}
                  label={heroLabel(id)}
                  active={id === laneMeleeHeroId}
                  locked={!unlocked}
                  onSelect={unlocked ? () => setLaneMeleeHero(id) : undefined}
                />
              );
            })}
          </div>
          <div className="gw-cs-lane-col">
            <span className="gw-cs-lane-col-title">Ranged guard</span>
            {rangedHeroOpts.map((id) => {
              const unlocked = isLaneGuardUnlocked(id, factionId);
              return (
                <LaneGuardCard
                  key={id}
                  unitId={id}
                  label={heroLabel(id)}
                  active={id === laneRangedHeroId}
                  locked={!unlocked}
                  onSelect={unlocked ? () => setLaneRangedHero(id) : undefined}
                />
              );
            })}
          </div>
        </div>
      </section>

      <PreMatchLaneDeploy />

      <Loadout />
    </div>
  );
}