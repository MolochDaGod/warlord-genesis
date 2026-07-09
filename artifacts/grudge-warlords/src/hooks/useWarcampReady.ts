import { isLoadoutReady } from "../game/roster";
import { useMeta } from "../game/metaProgression";
import { useRoster } from "../game/roster";

export type WarcampBlockReason = "starter" | "locked" | "loadout" | null;

export function warcampBlockMessage(reason: WarcampBlockReason): string {
  switch (reason) {
    case "starter":
      return "Choose your starter champion in the overlay above.";
    case "locked":
      return "Recruit this warlord with 10 shards in the War Chest, or pick your unlocked starter.";
    case "loadout":
      return "Select an unlocked warlord in the Warcamp tab — canonical weapons apply automatically.";
    default:
      return "Configure lane wave troops, then march.";
  }
}

export function evaluateWarcampReady(): {
  ready: boolean;
  blockReason: WarcampBlockReason;
  loadoutReady: boolean;
  characterUnlocked: boolean;
  onboardingDone: boolean;
} {
  const { prefabId, meleeId, rangedId } = useRoster.getState();
  const meta = useMeta.getState();
  const loadoutReady = isLoadoutReady(meleeId, rangedId, prefabId);
  const characterUnlocked = meta.isCharacterUnlocked(prefabId);
  const onboardingDone = meta.onboardingDone;
  const ready = onboardingDone && loadoutReady && characterUnlocked;
  const blockReason: WarcampBlockReason = !onboardingDone
    ? "starter"
    : !characterUnlocked
      ? "locked"
      : !loadoutReady
        ? "loadout"
        : null;
  return { ready, blockReason, loadoutReady, characterUnlocked, onboardingDone };
}

/** Reactive march readiness for /deploy — updates when roster or meta changes. */
export function useWarcampReady() {
  const prefabId = useRoster((s) => s.prefabId);
  const meleeId = useRoster((s) => s.meleeId);
  const rangedId = useRoster((s) => s.rangedId);
  const onboardingDone = useMeta((s) => s.onboardingDone);
  const isCharacterUnlocked = useMeta((s) => s.isCharacterUnlocked);

  const loadoutReady = isLoadoutReady(meleeId, rangedId, prefabId);
  const characterUnlocked = isCharacterUnlocked(prefabId);
  const ready = onboardingDone && loadoutReady && characterUnlocked;

  const blockReason: WarcampBlockReason = !onboardingDone
    ? "starter"
    : !characterUnlocked
      ? "locked"
      : !loadoutReady
        ? "loadout"
        : null;

  return { ready, blockReason, loadoutReady, characterUnlocked, onboardingDone };
}