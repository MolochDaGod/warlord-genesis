import { useCommand } from "./command";
import { useGame } from "./store";
import { REPAIR_AMOUNT, SHOP_BUILDS, type ShopItem } from "./config";

/** Fortify shop row mapped to RTS hotkeys 1–5 (cannon → repair). */
export const BUILD_HOTKEY_ITEMS: ShopItem[] = SHOP_BUILDS;

export function findBuildItem(ref: string): ShopItem | undefined {
  return SHOP_BUILDS.find((b) => b.ref === ref);
}

/** Arm a ghost structure for placement (command mode). */
export function armBuild(ref: string): boolean {
  const item = findBuildItem(ref);
  if (!item || item.kind !== "build") return false;
  const cmd = useCommand.getState();
  const g = useGame.getState();
  cmd.setMode("command");
  cmd.setBuild({ ref: item.ref, cost: item.cost });
  g.pushMessage("CHOOSE WHERE TO RAISE IT", "info");
  return true;
}

/** Instant citadel repair (hotkey 5 / shop click). */
export function repairCitadel(): boolean {
  const g = useGame.getState();
  const item = findBuildItem("core");
  if (!item) return false;
  if (g.allyCoreHp >= g.allyCoreMax) {
    g.pushMessage("CITADEL ALREADY AT FULL STRENGTH", "warn");
    return false;
  }
  if (g.credits < item.cost) {
    g.pushMessage("NOT ENOUGH CREDITS", "warn");
    return false;
  }
  g.spendCredits(item.cost);
  g.repairAllyCore(REPAIR_AMOUNT);
  g.pushMessage("THE CITADEL IS MENDED", "good");
  return true;
}

/** Handle digit hotkey 1–5 in command mode. */
export function activateBuildHotkey(slot: number): void {
  const item = BUILD_HOTKEY_ITEMS[slot];
  if (!item) return;
  if (item.kind === "repair") {
    repairCitadel();
    return;
  }
  if (item.kind === "build") {
    const cmd = useCommand.getState();
    if (cmd.build?.ref === item.ref) {
      cmd.setBuild(null);
      useGame.getState().pushMessage("BUILD CANCELLED", "info");
      return;
    }
    armBuild(item.ref);
  }
}