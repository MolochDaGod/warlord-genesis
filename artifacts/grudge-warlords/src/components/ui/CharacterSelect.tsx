import { useMemo } from "react";
import { HERO_PRESETS } from "../../game/anim/presets";
import { useRoster, effectiveWeaponClass } from "../../game/roster";
import { heroThumb, HERO_GRUDGE_RACE } from "../../game/heroModels";
import { HeroCarousel, type CarouselHero } from "./HeroCarousel";
import { Loadout } from "./Loadout";
import "./characterSelect.css";

export function CharacterSelect() {
  const heroId = useRoster((s) => s.heroId);
  const setHero = useRoster((s) => s.setHero);
  const equipment = useRoster((s) => s.equipment);

  const heroes = useMemo<CarouselHero[]>(
    () => HERO_PRESETS.map((p) => ({ id: p.id, name: p.name })),
    [],
  );

  const selected = Math.max(
    0,
    heroes.findIndex((h) => h.id === heroId),
  );
  const preset = HERO_PRESETS[selected]!;
  const weaponClass = effectiveWeaponClass(heroId, equipment);
  const equippedWeapon = equipment.weapon;

  const select = (i: number) => {
    const h = heroes[((i % heroes.length) + heroes.length) % heroes.length];
    if (h) setHero(h.id);
  };

  return (
    <div className="gw-cs">
      <div className="gw-cs-label">CHOOSE YOUR WARLORD</div>

      <div className="gw-cs-carousel" style={{ ["--cs-accent" as string]: preset.accent }}>
        <button
          className="gw-cs-arrow gw-cs-arrow-l"
          onClick={() => select(selected - 1)}
          aria-label="Previous hero"
        >
          ‹
        </button>
        <div className="gw-cs-stage">
          <HeroCarousel heroes={heroes} selected={selected} onSelect={select} />
        </div>
        <button
          className="gw-cs-arrow gw-cs-arrow-r"
          onClick={() => select(selected + 1)}
          aria-label="Next hero"
        >
          ›
        </button>
      </div>

      <div className="gw-cs-hero">
        <div className="gw-cs-hero-name">{preset.name}</div>
        {HERO_GRUDGE_RACE[preset.id] && (
          <div className="gw-cs-race" title="GRUDGE 6 race affinity">
            {HERO_GRUDGE_RACE[preset.id].replace(/-/g, " ")}
          </div>
        )}
        <div className="gw-cs-hero-weapon">
          {equippedWeapon ? equippedWeapon.name : preset.weaponLabel}
          <span className="gw-cs-hero-class">· {weaponClass}</span>
        </div>
        <div className="gw-cs-hero-blurb">{preset.blurb}</div>
      </div>

      <div className="gw-cs-thumbs">
        {heroes.map((h, i) => {
          const thumb = heroThumb(h.id);
          return (
            <button
              key={h.id}
              className={`gw-cs-thumb${i === selected ? " is-active" : ""}`}
              onClick={() => select(i)}
              title={h.name}
            >
              {thumb ? (
                <img src={thumb} alt={h.name} draggable={false} />
              ) : (
                <span>{h.name[0]}</span>
              )}
            </button>
          );
        })}
      </div>

      <Loadout />
    </div>
  );
}
