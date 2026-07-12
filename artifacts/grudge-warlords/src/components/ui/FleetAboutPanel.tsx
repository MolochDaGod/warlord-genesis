import { GRUDGE_FLEET_URLS } from "../../lib/fleetUrls";

/** Canonical fleet truth — replaces legacy “about” copy that pointed at retired SSOT. */
export function FleetAboutPanel() {
  return (
    <div className="gw-hub-body gw-about-hub">
      <h2 className="gw-about-title">Fleet ONE TRUTH</h2>
      <p>
        <strong>Warlord Genesis</strong> is the public warcamp (Three.js + R3F + Rapier + GRUDGE6). Player state is
        not invented here — it uses the same Railway Postgres as the rest of the fleet.
      </p>
      <div className="gw-account-grid">
        <div>
          <span className="gw-account-k">Auth</span>
          <span className="gw-account-v">id.grudge-studio.com</span>
        </div>
        <div>
          <span className="gw-account-k">Game data</span>
          <span className="gw-account-v">Railway /api/*</span>
        </div>
        <div>
          <span className="gw-account-k">Characters</span>
          <span className="gw-account-v">/api/characters</span>
        </div>
        <div>
          <span className="gw-account-k">Wallet</span>
          <span className="gw-account-v">/api/wallet (account)</span>
        </div>
        <div>
          <span className="gw-account-k">Treaty</span>
          <span className="gw-account-v">/api/treaty (account)</span>
        </div>
        <div>
          <span className="gw-account-k">Meshes</span>
          <span className="gw-account-v">assets.grudge-studio.com R2</span>
        </div>
      </div>
      <p className="gw-about-muted">
        <strong>Do not use:</strong> api.grudge-studio.com for player SSOT · MySQL VPS · D1 for characters · Puter KV as
        sole truth.
      </p>
      <p className="gw-about-muted">
        Links:{" "}
        <a href={GRUDGE_FLEET_URLS.hub} target="_blank" rel="noreferrer">
          grudge.studio
        </a>
        {" · "}
        <a href={GRUDGE_FLEET_URLS.warlords} target="_blank" rel="noreferrer">
          Warlords
        </a>
        {" · "}
        <a href={GRUDGE_FLEET_URLS.forge} target="_blank" rel="noreferrer">
          Forge
        </a>
        {" · "}
        <a href={GRUDGE_FLEET_URLS.warlordGenesis} target="_blank" rel="noreferrer">
          Play live
        </a>
      </p>
    </div>
  );
}
