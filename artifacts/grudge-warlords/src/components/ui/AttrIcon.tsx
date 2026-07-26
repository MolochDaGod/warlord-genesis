import { attrIconUrl, attrTooltip, type AttrId } from "../../lib/attributes";

type Props = {
  id: AttrId | string;
  value?: number;
  size?: number;
  className?: string;
  /** Prefer same-origin /icons/attributes (deployed with the game). */
  local?: boolean;
};

/**
 * Attribute badge for tooltips, stat rows, and identifiers.
 * Always renders the Warlords Era sigil set — never skill/weapon icons.
 */
export function AttrIcon({ id, value, size = 28, className = "", local = false }: Props) {
  const title = attrTooltip(id, value);
  const src = attrIconUrl(id, local);
  return (
    <img
      className={`gw-attr-icon ${className}`.trim()}
      src={src}
      alt={title}
      title={title}
      width={size}
      height={size}
      draggable={false}
      data-attr-id={String(id).toLowerCase()}
      style={{ width: size, height: size, objectFit: "contain", borderRadius: 6 }}
      onError={(e) => {
        // Fallback chain: local → CDN sigils only (never another icon pack).
        const el = e.currentTarget;
        const key = String(id).toLowerCase();
        const cdn = `https://assets.grudge-studio.com/icons/sigils/${key}.png`;
        if (el.src !== cdn) el.src = cdn;
      }}
    />
  );
}
