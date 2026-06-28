/**
 * Game UI Kit — HTML5 Canvas 9-slice renderer.
 *
 * Single source of truth: this exact file is imported directly by the in-editor
 * live preview AND emitted verbatim into the `canvas/` export target, so what
 * you preview is byte-for-byte what ships. Keep it dependency-free and
 * framework-free so both consumers behave identically.
 *
 * Draws themed panels, bars and slot grids straight onto a 2D canvas, reading
 * tokens + frame art from a manifest. `resolve(path)` maps a pack-relative
 * asset path to a usable URL (e.g. "../assets/" + path for the export, or the
 * Vite asset base live).
 */

const edges = (v) => {
  if (typeof v === "number") return [v, v, v, v];
  const p = String(v).trim().split(/\s+/).map(Number);
  return p.length === 1 ? [p[0], p[0], p[0], p[0]] : p; // [top,right,bottom,left]
};

export function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

/** Draw a 9-slice frame. slice = source px, border = destination px. */
export function nineSlice(ctx, img, x, y, w, h, slice, border) {
  const [st, sr, sb, sl] = edges(slice);
  const [bt, br, bb, bl] = edges(border);
  const iw = img.width, ih = img.height;
  const d = (sx, sy, sw, sh, dx, dy, dw, dh) => { if (sw > 0 && sh > 0 && dw > 0 && dh > 0) ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh); };
  // corners
  d(0, 0, sl, st, x, y, bl, bt);
  d(iw - sr, 0, sr, st, x + w - br, y, br, bt);
  d(0, ih - sb, sl, sb, x, y + h - bb, bl, bb);
  d(iw - sr, ih - sb, sr, sb, x + w - br, y + h - bb, br, bb);
  // edges
  d(sl, 0, iw - sl - sr, st, x + bl, y, w - bl - br, bt);
  d(sl, ih - sb, iw - sl - sr, sb, x + bl, y + h - bb, w - bl - br, bb);
  d(0, st, sl, ih - st - sb, x, y + bt, bl, h - bt - bb);
  d(iw - sr, st, sr, ih - st - sb, x + w - br, y + bt, br, h - bt - bb);
  // center
  d(sl, st, iw - sl - sr, ih - st - sb, x + bl, y + bt, w - bl - br, h - bt - bb);
}

export function bar(ctx, x, y, w, h, pct, color, track = "rgba(0,0,0,0.5)") {
  ctx.fillStyle = track; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, pct)), h);
}

/** Draw the themed demo HUD onto `canvas` from a manifest object. */
export async function renderHud(canvas, manifest, resolve) {
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const m = manifest;
  const t = m.tokens;
  const win = m.images.window;
  const slot = m.images.slot;
  const frame = win ? await loadImage(resolve(win.src)) : null;
  const slotImg = slot ? await loadImage(resolve(slot.src)) : null;
  const icons = await Promise.all(Array.from({ length: 8 }, (_, i) =>
    loadImage(resolve("cyberpunk/3_icons/icons/icon_" + String(i + 1).padStart(2, "0") + ".png"))));

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = t["--gk-surface"] || "#141b2e";
  ctx.fillRect(40, 40, 480, 300);
  if (frame) nineSlice(ctx, frame, 40, 40, 480, 300, win.slice, win.width);

  ctx.fillStyle = t["--gk-ink"] || "#dbe4ff";
  ctx.font = "20px " + (t["--gk-font"] || "monospace").replace(/['"]/g, "").split(",")[0];
  ctx.fillText("CANVAS HUD", 72, 84);

  bar(ctx, 72, 110, 200, 16, 0.72, t["--gk-danger"] || "#f43f5e");
  bar(ctx, 72, 136, 200, 16, 0.48, t["--gk-mana"] || "#38bdf8");

  // slot grid
  const sx = 72, sy = 180, size = 52, gap = 8;
  for (let i = 0; i < 8; i++) {
    const gx = sx + (i % 4) * (size + gap), gy = sy + Math.floor(i / 4) * (size + gap);
    ctx.fillStyle = t["--gk-surface-2"] || "#1d2740";
    ctx.fillRect(gx, gy, size, size);
    if (slotImg) nineSlice(ctx, slotImg, gx, gy, size, size, slot.slice, slot.width);
    ctx.drawImage(icons[i], gx + size / 2 - 12, gy + size / 2 - 12, 24, 24);
  }
}

/** Self-contained boot used by the exported canvas/index.html. */
export async function boot(canvas, manifestUrl = "../manifest.json", assetBase = "../assets/") {
  const manifest = await fetch(manifestUrl).then((r) => r.json());
  return renderHud(canvas, manifest, (p) => assetBase + p);
}
