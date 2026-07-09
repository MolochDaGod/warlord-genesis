import * as THREE from "three";

// ── Animation director ────────────────────────────────────────────────────────
//
// A tick-driven orchestrator that owns the character's AnimationMixer and blends
// everything the world plays on the live skeleton. It exists to replace the old
// ad-hoc per-frame if/else crossfade with a small state machine that gives:
//
//   • SMOOTH BLENDED locomotion — idle→walk→run→sprint blended by a single damped
//     `gait` scalar (frame-rate independent), so starting/stopping ramps naturally
//     through walk instead of snapping between two clips.
//   • An OVERLAY channel for one-shots (attack / dodge / weapon skill) and loops
//     (the HUD anim preview). A single `overlayInfluence` (0..1) scales the whole
//     locomotion layer down as the overlay fades in, so the two layers never sum
//     past weight 1 (the classic additive-overshoot bug).
//   • PREDICTIVE input buffering — a one-shot requested while another is mid-play is
//     queued and fired the instant the active one enters its blend-out window, so
//     combos/dodges feel responsive without clipping the current move.
//
// Pure three.js (no React); GameCharacter drives it each frame via `update(delta)`.

export interface LocoClips {
  idle: THREE.AnimationClip;
  walk: THREE.AnimationClip;
  run: THREE.AnimationClip;
  sprint: THREE.AnimationClip;
}

export interface OneShotOpts {
  /** Blend in/out time in seconds. */
  fade?: number;
  /** Playback speed multiplier. */
  timeScale?: number;
  /**
   * Peak overlay influence 0..1 (default 1 = fully replaces locomotion). Values
   * below 1 cross-blend the one-shot WITH the underlying locomotion, so the AI
   * assistant's "blend amount" plays the bound clip layered over movement.
   */
  blend?: number;
  /** Called once the one-shot has fully blended back out to locomotion. */
  onEnd?: () => void;
}

type LocoState = keyof LocoClips;

type OmniBandActions = Partial<Record<LocoState, THREE.AnimationAction>>;

// Gait band centers along the 0..1 `gait` axis. The damped gait sits between two
// neighbours and we cross-blend their two clips, so the body flows idle→walk→run→
// sprint instead of hard-switching.
const BANDS: { state: LocoState; at: number }[] = [
  { state: "idle", at: 0 },
  { state: "walk", at: 0.34 },
  { state: "run", at: 0.7 },
  { state: "sprint", at: 1 },
];

const GAIT_RATE_ACCEL = 9; // 1/s — ramp up to run/sprint
const GAIT_RATE_DECEL = 13; // 1/s — faster settle to idle (walk-through on stop)
const OVERLAY_EASE = 1.35; // slightly ease-in overlay influence for softer skill layers

// Clamp an overlay blend amount to [0,1], defaulting to a full takeover (1).
function clampBlend(v: number | undefined): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 1;
  return Math.min(1, Math.max(0, v));
}

export class AnimationDirector {
  readonly mixer: THREE.AnimationMixer;
  private loco: Record<LocoState, THREE.AnimationAction>;
  // Per-band playback speed, reapplied whenever a band's action is (re)built so a
  // live clip rebind (anim-test tool) can't silently reset e.g. the sprint cadence.
  private locoTimeScale: Record<LocoState, number> = {
    idle: 1,
    walk: 1,
    run: 1,
    sprint: 1,
  };

  private gait = 0;
  private gaitTarget = 0;

  // Overlay (one-shot or loop) state.
  private overlay: THREE.AnimationAction | null = null;
  private overlayLoop = false;
  private overlayFade = 0.12;
  private overlayInf = 0; // current influence 0..1
  private overlayTarget = 0; // influence target
  private finishing = false; // overlay ended / cleared → ramping out then dropping
  private overlayEnd: (() => void) | null = null;

  // Distinct cloned clips for overlay actions, so an overlay that happens to reuse
  // a locomotion clip (e.g. previewing "Run") gets its OWN action and can't fight
  // the locomotion-layer weight on the shared action.
  private overlayClones = new Map<string, THREE.AnimationClip>();

  // Buffered (predictive) one-shot, fired at the active one-shot's blend-out window.
  private buffered: { clip: THREE.AnimationClip; opts: OneShotOpts } | null = null;

  // Omnidirectional locomotion: per-band clips keyed by move direction (8-way).
  private omniEnabled = false;
  private omniBands: OmniBandActions = {};
  private omniKeys: Record<LocoState, string> = {
    idle: "",
    walk: "",
    run: "",
    sprint: "",
  };

  constructor(mixer: THREE.AnimationMixer, clips: LocoClips) {
    this.mixer = mixer;
    const mk = (clip: THREE.AnimationClip): THREE.AnimationAction => {
      const a = mixer.clipAction(clip);
      a.setLoop(THREE.LoopRepeat, Infinity);
      a.enabled = true;
      a.setEffectiveWeight(0);
      a.play();
      return a;
    };
    this.loco = {
      idle: mk(clips.idle),
      walk: mk(clips.walk),
      run: mk(clips.run),
      sprint: mk(clips.sprint),
    };
    this.loco.idle.setEffectiveWeight(1);
    this.mixer.addEventListener("finished", this.onFinished);
  }

  /** True while a one-shot overlay (not a loop) is playing. */
  get busy(): boolean {
    return this.overlay !== null && !this.overlayLoop && !this.finishing;
  }

  /** True while a looping overlay (e.g. a held anim preview) is playing. */
  get loopActive(): boolean {
    return this.overlay !== null && this.overlayLoop;
  }

  /** Set the desired gait from movement intent; `update` damps toward it. */
  setGaitTarget(moving: boolean, sprinting: boolean): void {
    this.gaitTarget = !moving ? 0 : sprinting ? 1 : 0.7;
  }

  /** When true, omni band actions drive locomotion instead of the forward-only set. */
  setOmniEnabled(on: boolean): void {
    this.omniEnabled = on;
    if (!on) {
      for (const a of Object.values(this.omniBands)) a?.setEffectiveWeight(0);
    }
  }

  /**
   * Swap a locomotion band's omni clip (async-loaded by GameCharacter). No-op when
   * `rel` matches the band's current key.
   */
  setOmniBandClip(state: LocoState, rel: string, clip: THREE.AnimationClip, fade = 0.12): void {
    if (this.omniKeys[state] === rel && this.omniBands[state]) return;
    const prev = this.omniBands[state];
    if (prev) {
      prev.stop();
      this.mixer.uncacheAction(prev.getClip());
    }
    const a = this.mixer.clipAction(clip);
    a.setLoop(THREE.LoopRepeat, Infinity);
    a.enabled = true;
    a.setEffectiveWeight(0);
    a.timeScale = this.locoTimeScale[state];
    a.play();
    if (prev && prev !== a) prev.fadeOut(fade);
    this.omniKeys[state] = rel;
    this.omniBands[state] = a;
  }

  /**
   * Live-swap the clip backing a locomotion band (the anim-test binding tool).
   * Preserves the current effective weight so the blend doesn't pop, and uncaches
   * the old action so reverting to the default clip rebuilds cleanly.
   */
  setLocoClip(state: LocoState, clip: THREE.AnimationClip): void {
    const old = this.loco[state];
    if (old.getClip() === clip) return; // already bound to this clip
    const weight = old.getEffectiveWeight();
    old.stop();
    this.mixer.uncacheAction(old.getClip());
    const a = this.mixer.clipAction(clip);
    a.setLoop(THREE.LoopRepeat, Infinity);
    a.enabled = true;
    a.setEffectiveWeight(weight);
    a.timeScale = this.locoTimeScale[state];
    a.play();
    this.loco[state] = a;
  }

  /** Set the playback speed of a locomotion band's action (e.g. faster sprint legs). */
  setLocoTimeScale(state: LocoState, timeScale: number): void {
    this.locoTimeScale[state] = timeScale;
    this.loco[state].timeScale = timeScale;
  }

  /** The live playback speed of a locomotion band's current action. */
  getLocoTimeScale(state: LocoState): number {
    return this.loco[state].timeScale;
  }

  private overlayActionFor(clip: THREE.AnimationClip): THREE.AnimationAction {
    let c = this.overlayClones.get(clip.uuid);
    if (!c) {
      c = clip.clone();
      this.overlayClones.set(clip.uuid, c);
    }
    return this.mixer.clipAction(c);
  }

  /** Play a one-shot immediately, replacing any current overlay. */
  playOneShot(clip: THREE.AnimationClip, opts: OneShotOpts = {}): void {
    if (this.overlay) this.overlay.stop();
    const a = this.overlayActionFor(clip);
    a.reset();
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.timeScale = opts.timeScale ?? 1;
    a.setEffectiveWeight(1);
    a.play();
    this.overlay = a;
    this.overlayLoop = false;
    this.overlayFade = opts.fade ?? 0.12;
    this.overlayTarget = clampBlend(opts.blend);
    this.finishing = false;
    this.overlayEnd = opts.onEnd ?? null;
    this.buffered = null;
  }

  /**
   * Request a one-shot with predictive buffering: if a one-shot is already mid-play
   * and not yet in its blend-out window, queue this one and fire it the moment the
   * active one nears its end. Otherwise play immediately.
   */
  requestOneShot(clip: THREE.AnimationClip, opts: OneShotOpts = {}): void {
    if (this.overlay && !this.overlayLoop && !this.finishing) {
      const remaining = this.overlay.getClip().duration - this.overlay.time;
      if (remaining > (opts.fade ?? 0.12)) {
        this.buffered = { clip, opts };
        return;
      }
    }
    this.playOneShot(clip, opts);
  }

  /** Play a looping overlay (held until cleared) — used by the HUD anim preview. */
  playLoop(clip: THREE.AnimationClip, fade = 0.15, blend = 1): void {
    if (this.overlay) this.overlay.stop();
    const a = this.overlayActionFor(clip);
    a.reset();
    a.setLoop(THREE.LoopRepeat, Infinity);
    a.clampWhenFinished = false;
    a.timeScale = 1;
    a.setEffectiveWeight(1);
    a.play();
    this.overlay = a;
    this.overlayLoop = true;
    this.overlayFade = fade;
    this.overlayTarget = clampBlend(blend);
    this.finishing = false;
    this.overlayEnd = null;
    this.buffered = null;
  }

  /** Blend the current overlay back out and hand control to locomotion. */
  clearOverlay(fade = 0.15): void {
    if (!this.overlay) return;
    this.overlayFade = fade;
    this.overlayTarget = 0;
    this.finishing = true;
  }

  private onFinished = (e: { action: THREE.AnimationAction }): void => {
    if (this.overlay && e.action === this.overlay && !this.overlayLoop) {
      this.finishing = true;
      this.overlayTarget = 0;
    }
  };

  update(delta: number): void {
    // Gait damp (frame-rate independent) → cross-blend the two surrounding bands.
    const gaitRate =
      this.gaitTarget < this.gait ? GAIT_RATE_DECEL : GAIT_RATE_ACCEL;
    this.gait += (this.gaitTarget - this.gait) * (1 - Math.exp(-gaitRate * delta));
    const w: Record<LocoState, number> = { idle: 0, walk: 0, run: 0, sprint: 0 };
    if (this.gait >= 1) {
      w.sprint = 1;
    } else {
      for (let i = 0; i < BANDS.length - 1; i++) {
        const a = BANDS[i];
        const b = BANDS[i + 1];
        if (this.gait >= a.at && this.gait <= b.at) {
          const t = (this.gait - a.at) / (b.at - a.at);
          w[a.state] = 1 - t;
          w[b.state] = t;
          break;
        }
      }
    }

    // Overlay influence ramp + predictive buffer handoff + drop-when-done.
    if (this.overlay) {
      const k =
        (1 - Math.exp(-(OVERLAY_EASE / Math.max(0.02, this.overlayFade)) * delta));
      this.overlayInf += (this.overlayTarget - this.overlayInf) * k;

      if (this.buffered && !this.overlayLoop && !this.finishing) {
        const remaining = this.overlay.getClip().duration - this.overlay.time;
        if (remaining <= this.overlayFade) {
          const b = this.buffered;
          this.buffered = null;
          this.playOneShot(b.clip, b.opts);
        }
      }

      if (this.finishing && this.overlayInf < 0.02) {
        this.overlay.stop();
        const end = this.overlayEnd;
        this.overlay = null;
        this.overlayEnd = null;
        this.finishing = false;
        this.overlayInf = 0;
        if (end) end();
      }
    } else {
      this.overlayInf = 0;
    }

    const locoScale = 1 - this.overlayInf;
    const useOmni =
      this.omniEnabled && BANDS.some(({ state }) => this.omniBands[state] !== undefined);
    if (useOmni) {
      this.loco.idle.setEffectiveWeight(0);
      this.loco.walk.setEffectiveWeight(0);
      this.loco.run.setEffectiveWeight(0);
      this.loco.sprint.setEffectiveWeight(0);
      for (const { state } of BANDS) {
        const a = this.omniBands[state];
        if (a) a.setEffectiveWeight(w[state] * locoScale);
      }
    } else {
      for (const a of Object.values(this.omniBands)) a?.setEffectiveWeight(0);
      this.loco.idle.setEffectiveWeight(w.idle * locoScale);
      this.loco.walk.setEffectiveWeight(w.walk * locoScale);
      this.loco.run.setEffectiveWeight(w.run * locoScale);
      this.loco.sprint.setEffectiveWeight(w.sprint * locoScale);
    }
    if (this.overlay) this.overlay.setEffectiveWeight(this.overlayInf);

    this.mixer.update(delta);
  }

  dispose(): void {
    this.mixer.removeEventListener("finished", this.onFinished);
    this.overlayClones.clear();
    this.omniBands = {};
    this.omniKeys = { idle: "", walk: "", run: "", sprint: "" };
  }
}
