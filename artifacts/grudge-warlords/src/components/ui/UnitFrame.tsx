import ufFrame from "@assets/uf_frame_1782526063043.png";
import uf2Frame from "@assets/uf2_frame_1782526063042.png";
import uf3Frame from "@assets/uf3_frame_1782526063042.png";
import ufAvatar from "@assets/uf_avatar_overlay_1782526063042.png";
import uf2Avatar from "@assets/uf2_avatar_overlay_1782526063042.png";
import ufLevel from "@assets/uf_level_frame_1782526063043.png";
import fillGreen from "@assets/uf_fill_green_1782526063043.png";
import fillOrange from "@assets/uf_fill_orange_1782526063043.png";
import fillRed from "@assets/uf3_fill_red_1782526063042.png";
import fillBlue from "@assets/uf2_fill_blue_1782526063042.png";

export type FillKind = "green" | "orange" | "red" | "blue";

const FILLS: Record<FillKind, string> = {
  green: fillGreen,
  orange: fillOrange,
  red: fillRed,
  blue: fillBlue,
};

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/**
 * Skinned portrait unit-frame (citadels, hero). `lg` uses the large fantasy
 * frame, `sm` the compact one. The colored disc + ring sit in the frame's
 * socket; the value bar is filled with the tiling fill texture.
 */
export function PortraitFrame({
  variant,
  crest,
  level,
  label,
  value,
  pct,
  fill,
}: {
  variant: "lg" | "sm";
  crest: string;
  level?: string;
  label: string;
  value: string;
  pct: number;
  fill: FillKind;
}) {
  const frame = variant === "lg" ? ufFrame : uf2Frame;
  const avatar = variant === "lg" ? ufAvatar : uf2Avatar;
  const w = clamp(pct);
  return (
    <div className={`uf uf-${variant}`}>
      <img className="uf-bg" src={frame} alt="" draggable={false} />
      <div className="uf-socket">
        <div className="uf-portrait" style={{ background: crest }} />
        <img className="uf-ring" src={avatar} alt="" draggable={false} />
        {level !== undefined && (
          <div className="uf-level">
            <img src={ufLevel} alt="" draggable={false} />
            <span>{level}</span>
          </div>
        )}
      </div>
      <div className="uf-bars">
        <div className="uf-row">
          <span className="uf-label">{label}</span>
          <span className="uf-value">{value}</span>
        </div>
        <div className="uf-bar">
          <div className="uf-fill" style={{ width: `${w}%`, backgroundImage: `url(${FILLS[fill]})` }} />
        </div>
      </div>
    </div>
  );
}

/** Skinned horizontal bar frame (hero ammo / secondary resources). */
export function BarFrame({
  label,
  value,
  pct,
  fill,
}: {
  label?: string;
  value?: string;
  pct: number;
  fill: FillKind;
}) {
  const w = clamp(pct);
  return (
    <div className="ufb">
      <img className="ufb-bg" src={uf3Frame} alt="" draggable={false} />
      <div className="ufb-track">
        <div className="ufb-fill" style={{ width: `${w}%`, backgroundImage: `url(${FILLS[fill]})` }} />
      </div>
      {(label || value) && (
        <div className="ufb-row">
          {label && <span className="uf-label">{label}</span>}
          {value && <span className="uf-value">{value}</span>}
        </div>
      )}
    </div>
  );
}
