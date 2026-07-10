# Battlefield map bake & best practices

## Bake command

```bash
npm run textures:bake
# or
node scripts/bake-map-textures.mjs --force
```

Writes tileable PBR maps under `/textures` and `textures/map-bake-manifest.json`.

| File | Role | Color space |
|------|------|-------------|
| `ground_diff.jpg` | Albedo (dirt/grass/rock blend) | sRGB (`zg`) |
| `ground_nor.jpg` | Tangent normal (from height) | linear (`Oo` / NoColorSpace) |
| `ground_rough.jpg` | Roughness grayscale | linear |
| `ground_ao.jpg` | Curvature AO | linear |
| `concrete_diff.jpg` / `metal_*.jpg` | Structure fillers | sRGB / linear normal |

CI runs bake before patch via `scripts/ci-build.mjs`.

## Runtime helpers (injected into fix3)

| Helper | Purpose |
|--------|---------|
| `WgPhysLayer` | Default / Terrain / Player / NPC / Projectile / Trigger / Item / … |
| `WgPhysGroups` | Rapier membership+filter bitmasks (16+16) |
| `WgPrepTexture` | wrap, anisotropy, mipmaps, colorSpace, flipY |
| `WgPrepTerrainTextures` | all four ground maps + UV repeat from map size |
| `WgPrepMesh` | shadows, frustum cull, material maps, `userData.physicsLayer` |

## Terrain (`Y$`)

- Heightmap mesh with vertex colors (height blend sand→grass)
- PBR `meshStandardMaterial`: map + normal + roughness + AO
- **Heightfield collider** (fixed RB, `colliders:false` + `HeightfieldCollider`) tagged **Terrain**
- Boundary walls: fixed cuboids, Terrain groups, friction
- Player capsule: **Player** collision groups

## Height bake (`$gA`)

- Step grid ~6m, ridge edges, flatter corridor center for lanes, mild noise

## Mesh / material rules

1. **Albedo** → sRGB; **data maps** (N/R/AO/metal) → linear / NoColorSpace  
2. Tile with `wrapS/T = RepeatWrapping`, anisotropy ≥ 4–8  
3. Skinned heroes: `WgPrepMesh(..., { physicsLayer: "Player" })`  
4. Prefer heightfield for ground; cuboids for walls; capsules for characters  
5. Tag `userData.physicsLayer` on roots for debug / ray filters  

## Physics layer matrix

| Layer | Collides with |
|-------|----------------|
| Terrain | Player, NPC, Item, Projectile |
| Player | Terrain, NPC, Item, Trigger |
| NPC | Terrain, Player, NPC, Trigger |
| Projectile | Terrain, NPC, Player |
| Trigger | Player, NPC (sensor) |
