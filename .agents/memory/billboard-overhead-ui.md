---
name: Billboarding overhead UI under a rotating parent
description: How to keep overhead bars/sprites camera-facing and constant-size when their parent group is rotated/scaled
---

In Grudge Warlords, units and structures are top-level `THREE.Group`s whose
`rotation.y` (yaw) and `scale` are driven every frame in `useFrame`. Overhead HP
bars / labels are children of those groups.

**Rule:** to make a child face the camera, you cannot just set
`child.quaternion.copy(camera.quaternion)` — that is a *local* quaternion, so the
parent's yaw still tilts it. Set the local quaternion to cancel the parent:
`child.quaternion.copy(parent.quaternion).invert().multiply(camera.quaternion)`.
This is valid because these groups are direct children of the scene, so
`group.quaternion` == world quaternion.

**Constant world size under a scaled parent:** counter-scale the bar by the
inverse of the parent scale: `bar.scale.setScalar(1 / unit.def.scale)`. The bar's
own *position* still lives in parent-local space, so it rides up/down with the
parent scale (keeps it above the head) while the bar itself stays a fixed size.

**Why:** the original code used the naive local-copy billboard and no
counter-scale, so bars tilted with unit yaw and grew/shrank with unit size; this
was visible on big elites and rotating turrets.
