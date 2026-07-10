/**
 * Battle HUD layout — mirrors _gA + gk-combat-hud + gw-moba-battle patches.
 * Lane deploy panel removed; production collapsed; shop docked in command mode.
 */
import type { CommandMode, GamePhase } from "../types";
import type { ReactNode } from "react";

export type BattleHudProps = {
  phase: GamePhase;
  mode: CommandMode;
  topBar?: ReactNode;
  minimap?: ReactNode;
  production?: ReactNode;
  actionBar?: ReactNode;
  orders?: ReactNode;
  shop?: ReactNode;
  messages?: ReactNode;
};

export function BattleHud({
  phase,
  mode,
  topBar,
  minimap,
  production,
  actionBar,
  orders,
  shop,
  messages,
}: BattleHudProps) {
  if (phase !== "battle") return null;

  const modeClass = mode === "combat" ? "gw-mode-combat" : "gw-mode-command";

  return (
    <div className={`gw-hud gk-root gk-combat-hud gw-moba-battle ${modeClass}`}>
      {topBar}
      {minimap}
      {messages}
      {mode === "command" && (
        <>
          {orders}
          {production}
          {shop}
        </>
      )}
      {mode === "combat" && actionBar}
    </div>
  );
}