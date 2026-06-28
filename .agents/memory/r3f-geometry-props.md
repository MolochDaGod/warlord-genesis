---
name: R3F geometry transform props
description: Where rotation/position belong on react-three-fiber primitives
---

In react-three-fiber, `rotation`/`position`/`scale` are properties of the **object3D (mesh/group)**, not of geometry elements. Putting `rotation={...}` on `<cylinderGeometry>`, `<coneGeometry>`, etc. fails typecheck with TS2322 ("Property 'rotation' does not exist on ... CylinderGeometry").

**Why:** geometry elements only accept their constructor `args` and buffer attributes; transforms live on the parent mesh.

**How to apply:** move the transform up to the wrapping `<mesh rotation={...}>` (or pre-rotate the geometry in a useMemo if you need the mesh's own rotation free).
