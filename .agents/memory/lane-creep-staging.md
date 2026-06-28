---
name: Lane creep staging / tower-danger AI
description: How single-player lane creeps avoid suiciding into towers (wave staging + target scoring) and the constraint that any staging gate needs an anti-stall release.
---

# Lane creep tactical AI (single-player game)

Lane creeps in the single-player game (`artifacts/grudge-warlords/src/game`, NOT
the PvP `lib/gw-sim`) used to follow a flow field straight into enemy towers and
die one at a time. The fix layers three behaviors on top of the flow field in
`Units.tsx` `decide()`:

1. **Tower-danger staging** — `nearestThreatAhead(u)` (combat.ts) returns the
   nearest alive hostile structure with `range > 0` that is *ahead* (closer to
   the unit's objective core than the unit). When a creep with no aggro target
   would enter that structure's range, it holds at `range + stageMargin` instead
   of walking in.
2. **Wave grouping** — it commits (returns null = advance/dive) only once
   `countUnitsNear(faction, ..., waveRadius) >= waveSize` friendly units have
   gathered, so waves dive together.
3. **Target scoring** — `findPriorityTarget` scores foes by closeness + missing
   HP + "is it attacking me", and only falls back to a structure when NO hostile
   unit is in range. This is what stops random tower aggro while a line exists.

**Why the anti-stall release matters:** a pure "wait for a wave" gate freezes a
lane forever if a straggler never gets `waveSize` support (e.g. center lane fed
by a single base push every ~24s). Every staging unit increments
`u.stageTimer` and commits anyway after `AI_LANE.maxStageTime`. Any future
tightening of the wave gate MUST keep an escape hatch or lanes deadlock.

**How to apply:** tunables live in `config.ts` `AI_LANE`. The objective ladder
(`isAttackable`) already gates which structure is the real target; staging keys
off the *nearest ahead* hostile structure, so it naturally walks outer tower →
inner tower → core as each falls. Behavior is symmetric (ally vs enemy creeps).
