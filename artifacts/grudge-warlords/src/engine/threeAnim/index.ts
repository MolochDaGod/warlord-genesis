/**
 * Three.js animation helpers ported from the Samurai third-person template
 * and the threejs-game-skills clip contract (idle / walk / attack / jump).
 */
export {
  freezeHipsTravel,
  hipsBoneName,
  indexRigBones,
  measureClipUnits,
  retargetClipToRig,
} from "./retargetClip";
export { CLIP_RUN_SPEED, CLIP_WALK_SPEED, lockGaitPhase, strideTimeScale } from "./phaseLock";
export {
  classifyConceptClips,
  conceptClip,
  type ConceptId,
} from "./conceptClips";
