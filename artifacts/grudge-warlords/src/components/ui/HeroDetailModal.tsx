import { useState } from "react";
import type { PrefabCharacter } from "@workspace/game-content";
import { CLASS_BY_ID, prefabClassSkills, prefabWeaponSkills } from "@workspace/game-content";
import { codexEntryForPrefab, heroCodexPageUrl, HERO_CODEX_ORIGIN } from "../../lib/heroCodex";
import {
  canonicalWeaponsForPrefab,
  meleeDisplayName,
  rangedDisplayName,
} from "../../game/canonicalLoadout";
import { SHARDS_PER_LEVEL, SHARDS_TO_UNLOCK, useMeta } from "../../game/metaProgression";
import { viewerUrl } from "../../lib/grudgeViewer";
import { HeroShowcase } from "./HeroShowcase";
import { HeroAIPanel } from "./HeroAIPanel";

type Tab = "overview" | "skills" | "lore" | "ai";

interface HeroDetailModalProps {
  prefab: PrefabCharacter;
  onClose: () => void;
  onSelect?: () => void;
}

export function HeroDetailModal({ prefab, onClose, onSelect }: HeroDetailModalProps) {
  const [tab, setTab] = useState<Tab>("overview");
  const codex = codexEntryForPrefab(prefab.id);
  const cls = CLASS_BY_ID[prefab.classId];
  const kit = canonicalWeaponsForPrefab(prefab.id);
  // Primitive selectors — avoid shardProgress() object identity (React #185).
  const level = useMeta(
    (s) => s.cards.find((c) => c.kind === "character" && c.id === prefab.id)?.level ?? 0,
  );
  const shards = useMeta(
    (s) => s.cards.find((c) => c.kind === "character" && c.id === prefab.id)?.shards ?? 0,
  );
  const need = level === 0 ? SHARDS_TO_UNLOCK : SHARDS_PER_LEVEL;
  const classSkills = prefabClassSkills(prefab);
  const weaponSkills = prefabWeaponSkills(prefab);

  return (
    <div className="gw-hero-modal-overlay" onClick={onClose} role="presentation">
      <div className="gw-hero-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button type="button" className="gw-hero-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="gw-hero-modal-layout">
          <div className="gw-hero-modal-showcase-col">
            <HeroShowcase prefab={prefab} />
            <div className="gw-hero-modal-caption">
              <span className="gw-hero-modal-rarity" style={{ color: codex?.factionColor ?? cls.color }}>
                {codex?.rarity ?? `★`.repeat(prefab.stars)}
              </span>
              <h2>{prefab.name}</h2>
              <p className="gw-hero-modal-title">{prefab.title}</p>
              {codex?.quote && <blockquote>{codex.quote}</blockquote>}
            </div>
          </div>

          <div className="gw-hero-modal-body">
            <nav className="gw-hero-modal-tabs">
              {(["overview", "skills", "lore", "ai"] as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={tab === t ? "is-active" : ""}
                  onClick={() => setTab(t)}
                >
                  {t === "ai" ? "AI Guide" : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </nav>

            <div className="gw-hero-modal-panel">
              {tab === "overview" && (
                <div className="gw-hero-modal-overview">
                  <div className="gw-hero-modal-statgrid">
                    <div><span>HP</span><strong>{prefab.stats.hp}</strong></div>
                    <div><span>ATK</span><strong>{prefab.stats.atk}</strong></div>
                    <div><span>DEF</span><strong>{prefab.stats.def}</strong></div>
                    <div><span>SPD</span><strong>{prefab.stats.spd}</strong></div>
                  </div>
                  <p className="gw-hero-modal-kit">
                    Canonical kit: {meleeDisplayName(prefab.id, kit.melee)} + {rangedDisplayName(kit.ranged)}
                  </p>
                  <p className="gw-hero-modal-progress">
                    Card tier {level || "locked"} · {shards}/{need} shards
                  </p>
                  {codex && (
                    <ul className="gw-hero-modal-tags">
                      <li>{codex.combatStyle}</li>
                      <li>{codex.difficulty}</li>
                      <li>{codex.alignment}</li>
                    </ul>
                  )}
                  <div className="gw-hero-modal-links">
                    <a href={viewerUrl(prefab.raceId, prefab.classId)} target="_blank" rel="noreferrer">
                      3D Viewer
                    </a>
                    {codex && (
                      <a href={heroCodexPageUrl(codex)} target="_blank" rel="noreferrer">
                        Hero Codex
                      </a>
                    )}
                    <a href={HERO_CODEX_ORIGIN} target="_blank" rel="noreferrer">
                      grudge-heros.puter.site
                    </a>
                  </div>
                  {onSelect && (
                    <button type="button" className="gw-btn" onClick={onSelect}>
                      DEPLOY THIS WARLORD
                    </button>
                  )}
                </div>
              )}

              {tab === "skills" && (
                <div className="gw-hero-modal-skills">
                  {codex?.abilities && (
                    <section>
                      <h3>Codex Abilities</h3>
                      <ul>
                        {codex.abilities.map((a) => (
                          <li key={a.name}>
                            <strong>{a.name}</strong>
                            {a.manaCost > 0 && <span className="gw-hero-mana">{a.manaCost} mana</span>}
                            <p>{a.description}</p>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                  <section>
                    <h3>Class Tree</h3>
                    <ul>
                      {classSkills.map((s) => (
                        <li key={s.id}>
                          <strong>{s.label}</strong>
                          <p>{s.description}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                  <section>
                    <h3>Weapon Tree</h3>
                    <ul>
                      {weaponSkills.map((s) => (
                        <li key={s.id}>
                          <strong>{s.label}</strong>
                          <p>{s.description}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>
              )}

              {tab === "lore" && (
                <div className="gw-hero-modal-lore">
                  <p>{codex?.lore ?? prefab.lore}</p>
                  {codex?.backstory && (
                    <>
                      <h3>Backstory</h3>
                      <p>{codex.backstory}</p>
                    </>
                  )}
                  {codex?.strengths && (
                    <>
                      <h3>Strengths</h3>
                      <ul>{codex.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
                    </>
                  )}
                  {codex?.weaknesses && (
                    <>
                      <h3>Weaknesses</h3>
                      <ul>{codex.weaknesses.map((s) => <li key={s}>{s}</li>)}</ul>
                    </>
                  )}
                  {codex?.flavorText && <p className="gw-hero-flavor">{codex.flavorText}</p>}
                </div>
              )}

              {tab === "ai" && <HeroAIPanel prefabId={prefab.id} heroName={prefab.name} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}