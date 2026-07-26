/**
 * Arena 3 level SSOT for shell + docs (Clash Royale–style Warlords).
 * Full implementation lives in artifacts/grudge-warlords.
 */
export const ARENA3_LEVEL = {
  id: "arena3-royale",
  label: "Royale Arena 3",
  source: "D:/Games/Models/arena3.glb",
  paths: ["models/maps/arena3.glb", "models/arena/arena3.glb"] as const,
  towers: {
    king: "core",
    princess: "outer left + right lanes",
  },
  deploy: "elixir cards on own half",
} as const;
