# R2 handoff — warlord-genesis assets → other machine (Grudge Studio)

**Bucket:** `grudge-assets`  
**CDN:** https://assets.grudge-studio.com  
**Uploaded:** ~200+ objects (see `docs/R2_HANDOFF_MANIFEST.json`)

Code is in git; multi‑hundred‑MB GLBs are **not** in git — pull them from R2/CDN.

---

## On the other computer (Grudge Studio)

### 1. Code (git)

```bash
git clone https://github.com/MolochDaGod/warlord-genesis.git
cd warlord-genesis
git fetch origin
# Prefer handoff branch if main is behind/divergent:
git checkout wip/machine-handoff-2026-07-26
# or: git pull origin main
npm install   # or pnpm i — match package manager on this machine
```

Related fleet apps (same Cloudflare/Vercel account):

| App | Domain | Repo (typical) |
|-----|--------|----------------|
| GrudgeBuilder / client | client.grudge-studio.com | GrudgeBuilder |
| warlord-genesis /edit | warlords paths | warlord-genesis |
| Character Foundry | character.grudge-studio.com | GCS |
| Assets CDN | assets.grudge-studio.com | R2 `grudge-assets` |

### 2. Pull model binaries from CDN

Prefix map (local folder ← CDN path):

| Local | CDN URL prefix |
|-------|----------------|
| `models/warlords-era/` | `https://assets.grudge-studio.com/models/warlords-era/` |
| `models/maps/` | `https://assets.grudge-studio.com/models/maps/` |
| `models/voxel-only/` | `https://assets.grudge-studio.com/models/voxel-only/` |
| `models/tools/` | `https://assets.grudge-studio.com/models/tools/` |
| `models/units/lowpo/` | `https://assets.grudge-studio.com/models/units/lowpo/` |
| `models/warlords/haven_shore/` | `https://assets.grudge-studio.com/models/warlords/haven_shore/` |
| `_tmp_untracked/public/` | `https://assets.grudge-studio.com/handoff/warlord-genesis/public/` |

**Examples:**

```bash
# Haven Shore island
curl -LO https://assets.grudge-studio.com/models/warlords/haven_shore/fruzer_islands.glb

# Canonical warlords-era trees
curl -LO https://assets.grudge-studio.com/models/warlords-era/nature/plants/ivy.glb
curl -LO https://assets.grudge-studio.com/models/warlords-era/nature/rocks/stylised_rocks_pack.glb

# Full list of keys
# open docs/R2_HANDOFF_MANIFEST.json → "keys"
```

**Or wrangler** (same Cloudflare account **Grudge**, logged in):

```bash
wrangler r2 object get grudge-assets/models/warlords-era/SOME.glb --file=./SOME.glb --remote
```

### 3. Load in Grudge Studio games

Always prefer CDN URLs in production loaders:

```
https://assets.grudge-studio.com/{r2Key}
```

Never commit multi‑GB trees to git; CDN is SSOT after this handoff.

---

## Upload scripts (source machine)

```bash
# Bulk (wrangler, concurrency=1 — Windows safe)
node scripts/upload-handoff-to-r2.mjs

# Large residual files (S3 multipart via R2 API keys in GrudgeBuilder/.env)
node scripts/upload-r2-multipart.mjs --resume
```

### Known large / flaky keys

These are >~60 MB and may need multipart or Draco‑optimized re‑upload if wrangler hits `UV_HANDLE_CLOSING` / SSL bad record MAC on Windows:

- `models/warlords-era/buildings/smeltery.glb` (~220 MB)
- `models/maps/arena3.glb` (~125 MB)
- `models/warlords-era/nature/rocks/stylised_rocks_pack.glb` (~99 MB) — **live on CDN**
- handoff mirrors of the above under `handoff/warlord-genesis/public/…`
- `handoff/.../steampunk_airship.glb` (~33 MB) — **uploaded**
- `handoff/.../stylized_rocks_70.glb` (~66 MB)

If a key 404s, re-run multipart or optimize with:

```bash
gltf-transform optimize in.glb out.glb --compress draco --texture-compress webp
wrangler r2 object put grudge-assets/KEY --file=out.glb --content-type=model/gltf-binary --remote
```

---

## Verify

```bash
curl -I https://assets.grudge-studio.com/models/warlords/haven_shore/fruzer_islands.glb
curl -I https://assets.grudge-studio.com/models/warlords-era/nature/plants/ivy.glb
curl -I https://assets.grudge-studio.com/models/warlords-era/nature/rocks/stylised_rocks_pack.glb
```

Expect **HTTP 200**.

---

## Manifest

See `docs/R2_HANDOFF_MANIFEST.json` for the full key list from the last bulk pass.
