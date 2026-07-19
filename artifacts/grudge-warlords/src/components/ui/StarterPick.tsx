import { useMeta } from "../../game/metaProgression";

/** Legacy overlay — production onboarding uses /onboarding/faction → warlord. */
export function StarterPick() {
  const onboardingDone = useMeta((s) => s.onboardingDone);
  if (onboardingDone) return null;
  return null;
}