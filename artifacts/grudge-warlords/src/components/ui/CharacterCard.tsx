import { CLASS_BY_ID, type PrefabCharacter } from "@workspace/game-content";
import { gearPresetFor } from "../../engine/grudge6";
import { resolvePortraitUrl, portraitFallbackUrl } from "../../lib/heroMedia";
import { codexEntryForPrefab } from "../../lib/heroCodex";
import {
  SHARDS_TO_UNLOCK,
  SHARDS_PER_LEVEL,
  skillCountForPrefab,
  useMeta,
} from "../../game/metaProgression";
import {
  canonicalWeaponsForPrefab,
  meleeDisplayName,
  rangedDisplayName,
} from "../../game/canonicalLoadout";

const CLASS_LABEL: Record<string, string> = {
  warrior: "Warrior",
  worge: "Worge",
  mage: "Mage",
  ranger: "Ranger",
};

interface CharacterCardProps {
  prefab: PrefabCharacter;
  active?: boolean;
  locked?: boolean;
  onSelect?: () => void;
  onInspect?: () => void;
  compact?: boolean;
}

export function CharacterCard({ prefab, active, locked, onSelect, onInspect, compact }: CharacterCardProps) {
  const { shards, need, level } = useMeta((s) => s.shardProgress("character", prefab.id));
  const gear = gearPresetFor(prefab.raceId, prefab.classId);
  const cls = CLASS_BY_ID[prefab.classId];
  const kit = canonicalWeaponsForPrefab(prefab.id);
  const meleeName = meleeDisplayName(prefab.id, kit.melee);
  const rangedName = rangedDisplayName(kit.ranged);
  const skills = skillCountForPrefab(prefab.id);
  const unlocked = level > 0;
  const codex = codexEntryForPrefab(prefab.id);
  const portrait = resolvePortraitUrl(prefab.id);
  const portraitFb = portraitFallbackUrl(prefab.id);

  const handleMainClick = () => {
    if (onSelect) onSelect();
    else onInspect?.();
  };

  return (
    <div
      className={`gw-char-card${active ? " is-active" : ""}${locked ? " is-locked" : ""}${compact ? " is-compact" : ""}`}
      style={{ ["--card-accent" as string]: codex?.factionColor ?? gear?.color ?? cls.color }}
      title={codex?.lore ?? prefab.lore}
    >
      <button type="button" className="gw-char-card-main" onClick={handleMainClick} disabled={locked && !onSelect && !onInspect}>
      {!compact && (portrait || portraitFb) && (
        <img
          className="gw-char-card-portrait"
          src={portrait || portraitFb}
          alt=""
          loading="lazy"
          onError={(e) => {
            const img = e.currentTarget;
            if (portraitFb && img.src !== portraitFb) img.src = portraitFb;
          }}
        />
      )}
      <div className="gw-char-card-top">
        <span className="gw-char-card-stars">{"★".repeat(prefab.stars)}</span>
        {unlocked && <span className="gw-char-card-lvl">T{level}</span>}
      </div>
      <span className="gw-char-card-name">{prefab.name}</span>
      {!compact && <span className="gw-char-card-title">{prefab.title}</span>}
      <span className="gw-char-card-meta">
        {prefab.raceId} · {CLASS_LABEL[prefab.classId]}
      </span>
      <span className="gw-char-card-gear">{gear?.label ?? prefab.classId}</span>
      {!compact && (
        <div className="gw-char-card-kit">
          <span>{meleeName}</span>
          <span>{rangedName}</span>
        </div>
      )}
      <div className="gw-char-card-skills">{skills} skills</div>
      <div className="gw-char-card-shards">
        {unlocked ? (
          <>
            <div
              className="gw-char-card-shard-fill"
              style={{ width: `${Math.min(100, (shards / need) * 100)}%` }}
            />
            <span className="gw-char-card-shard-text">
              {shards}/{need} → T{Math.min(8, level + 1)}
            </span>
          </>
        ) : (
          <span className="gw-char-card-shard-text">
            {shards}/{SHARDS_TO_UNLOCK} to unlock
          </span>
        )}
      </div>
      </button>
      {onInspect && onSelect && (
        <button type="button" className="gw-char-card-inspect" onClick={onInspect} aria-label="Inspect hero">
          ⓘ
        </button>
      )}
    </div>
  );
}

export function LaneGuardCard({
  unitId,
  label,
  active,
  locked,
  onSelect,
}: {
  unitId: string;
  label: string;
  active?: boolean;
  locked?: boolean;
  onSelect?: () => void;
}) {
  const { shards, need, level } = useMeta((s) => s.shardProgress("lane_guard", unitId));
  const unlocked = level > 0;
  const threshold = unlocked ? SHARDS_PER_LEVEL : SHARDS_TO_UNLOCK;

  return (
    <button
      type="button"
      className={`gw-char-card gw-lane-card${active ? " is-active" : ""}${locked ? " is-locked" : ""}`}
      onClick={onSelect}
      disabled={locked && !onSelect}
    >
      <span className="gw-char-card-name">{label}</span>
      {unlocked && <span className="gw-char-card-lvl">T{level}</span>}
      <div className="gw-char-card-shards">
        <span className="gw-char-card-shard-text">
          {unlocked ? `${shards}/${need} upgrade` : `${shards}/${threshold} unlock`}
        </span>
      </div>
    </button>
  );
}