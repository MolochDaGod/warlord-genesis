import lab from "@assets/header_icon_lab_1782526441783.png";
import settings from "@assets/header_icon_settings_1782526441784.png";
import tune from "@assets/header_icon_tune_1782526441785.png";
import chat from "@assets/header_icon_chat_1782526441785.png";
import chest from "@assets/header_icon_chest_1782526441786.png";
import cup from "@assets/header_icon_cup_1782526441786.png";
import fist from "@assets/header_icon_fist_1782526441787.png";
import hammer from "@assets/header_icon_hammer_1782526441788.png";

/** Shared fantasy header/button icons (parchment glyphs on transparent PNGs). */
export const ICONS = { lab, settings, tune, chat, chest, cup, fist, hammer } as const;

export type IconName = keyof typeof ICONS;
