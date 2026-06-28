/**
 * Game UI Kit — framework-free runtime.
 * Zero dependencies. Builds themed DOM widgets with .gk-* classes.
 * Pair with kit.css + theme.css (already styled by data-gk-theme).
 */

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "style" && typeof v === "object") Object.assign(node.style, v);
    else if (k === "class") node.className = v;
    else if (k.startsWith("data-") || k === "title") node.setAttribute(k, v);
    else node[k] = v;
  }
  for (const c of [].concat(children)) node.append(c?.nodeType ? c : document.createTextNode(String(c)));
  return node;
}

/** Root wrapper that activates a theme. */
export function root(theme, children = []) {
  const r = el("div", { class: "gk-root", "data-gk-theme": theme }, children);
  return r;
}

/** Titled panel (uses the window 9-slice frame). */
export function panel(title, body = []) {
  return el("div", { class: "gk-panel" }, [
    el("div", { class: "gk-titlebar" }, [el("span", { class: "gk-title" }, title)]),
    el("div", { class: "gk-panel__body" }, body),
  ]);
}

/** A labelled resource bar. variant: "health" | "mana" | "xp" | "" */
export function bar(label, pct, variant = "") {
  const fill = el("div", { class: "gk-bar__fill", style: { width: pct + "%" } });
  return el("div", { class: "gk-bar" + (variant ? " gk-bar--" + variant : "") }, [
    fill,
    el("span", { class: "gk-bar__label" }, label),
  ]);
}

/** Inventory-style slot grid. items = array of icon URLs (or null for empty). */
export function slotGrid(items, cols = 5) {
  const grid = el("div", { class: "gk-grid", style: { ["--gk-cols"]: String(cols) } });
  for (const src of items) {
    const slot = el("div", { class: "gk-slot" });
    if (src) slot.append(el("i", { class: "gk-icon", style: { ["--icon"]: "url('" + src + "')", width: "22px", height: "22px" } }));
    grid.append(slot);
  }
  return grid;
}

export function button(label, primary = false) {
  return el("button", { class: "gk-btn" + (primary ? " gk-btn--primary" : "") }, label);
}
