/**
 * Post-login faction selection — locks playable faction for the season.
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FACTIONS } from "@workspace/game-content";
import { useMeta } from "../game/metaProgression";
import { useRoster } from "../game/roster";
import { useSession } from "../game/session";
import { PRODUCTION_SEASON_LABEL } from "../lib/productionSeason";
import type { GrudgeFactionId } from "../engine/grudge6";

function NavigateLobby() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/lobby", { replace: true });
  }, [navigate]);
  return null;
}
function NavigateWarlord() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/onboarding/warlord", { replace: true });
  }, [navigate]);
  return null;
}

const FACTION_LORE: Record<string, string> = {
  crusade:
    "Humans & Barbarians of Odin's north. Blade, faith, and iron discipline.",
  fabled:
    "Elves & Dwarves under the Omni's light. Arcane craft and ancient honor.",
  legion:
    "Orcs & Undead of Madra's south. Conquest, bone, and endless grudges.",
};

export function FactionSelect() {
  const navigate = useNavigate();
  const user = useSession((s) => s.user);
  const chooseFaction = useMeta((s) => s.chooseFaction);
  const factionChosen = useMeta((s) => s.factionChosen);
  const onboardingDone = useMeta((s) => s.onboardingDone);
  const setFaction = useRoster((s) => s.setFaction);

  // Already chose — skip to warlord or lobby (effect-free redirect via early return)
  if (factionChosen && onboardingDone) {
    return <NavigateLobby />;
  }
  if (factionChosen) {
    return <NavigateWarlord />;
  }

  const pick = (id: GrudgeFactionId) => {
    chooseFaction(id);
    setFaction(id);
    navigate("/onboarding/warlord");
  };

  return (
    <div className="gw-screen gw-intro">
      <div className="gw-screen-inner" style={{ maxWidth: 920 }}>
        <span className="gw-brand-sub">{PRODUCTION_SEASON_LABEL}</span>
        <h1 className="gw-brand-title" style={{ fontSize: "clamp(1.6rem,4vw,2.4rem)" }}>
          Choose Your <span>Faction</span>
        </h1>
        <p className="gw-intro-tagline">
          {user
            ? `${user.displayName || user.username} — this choice locks your playable roster for the season.`
            : "Sign in required. Faction locks which warlords, lane guards, and upgrades you can use."}
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginTop: 28,
          }}
        >
          {FACTIONS.map((f) => (
            <button
              key={f.id}
              type="button"
              className="gw-btn"
              onClick={() => pick(f.id as GrudgeFactionId)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                textAlign: "left",
                padding: 18,
                minHeight: 180,
                border: `2px solid ${f.color}`,
                background: `linear-gradient(160deg, ${f.color}33 0%, rgba(0,0,0,0.55) 55%)`,
                boxShadow: `0 0 24px ${f.color}22`,
              }}
            >
              <span
                style={{
                  fontFamily: "Cinzel, serif",
                  fontSize: 22,
                  color: f.color,
                  letterSpacing: "0.06em",
                }}
              >
                {f.name}
              </span>
              <span style={{ fontSize: 12, opacity: 0.85, marginTop: 8, lineHeight: 1.45 }}>
                {FACTION_LORE[f.id] ?? f.motto}
              </span>
              <span style={{ marginTop: "auto", fontSize: 11, opacity: 0.65, paddingTop: 12 }}>
                Races: {(f.races as string[]).join(" · ")}
              </span>
            </button>
          ))}
        </div>

        <p style={{ marginTop: 20, fontSize: 12, opacity: 0.55 }}>
          Production rules: unlocks, shards, missions, and match XP only apply within your faction.
          Opponents can still be any faction in skirmish.
        </p>
      </div>
    </div>
  );
}
