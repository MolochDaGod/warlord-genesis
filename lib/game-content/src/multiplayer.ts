import { z } from "zod";

/**
 * Shared realtime message contracts for the api-server WebSocket channel.
 * Client and server both validate against these shapes — do not hand-roll JSON.
 */

export const mpClientHelloSchema = z.object({
  type: z.literal("hello"),
  /** Optional GRDG1. spawn code for the local hero spec. */
  specCode: z.string().max(4096).optional(),
});

export const mpMoveIntentSchema = z.object({
  type: z.literal("move"),
  dx: z.number().finite(),
  dz: z.number().finite(),
  seq: z.number().int().nonnegative(),
});

export const mpClientMessageSchema = z.discriminatedUnion("type", [
  mpClientHelloSchema,
  mpMoveIntentSchema,
]);

export type MpClientMessage = z.infer<typeof mpClientMessageSchema>;

export const mpEntitySnapshotSchema = z.object({
  id: z.string(),
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
  yaw: z.number().finite(),
});

export const mpServerWelcomeSchema = z.object({
  type: z.literal("welcome"),
  clientId: z.string(),
  tickHz: z.number().int().positive(),
});

export const mpWorldSnapshotSchema = z.object({
  type: z.literal("snapshot"),
  tick: z.number().int().nonnegative(),
  entities: z.array(mpEntitySnapshotSchema),
});

export const mpServerMessageSchema = z.discriminatedUnion("type", [
  mpServerWelcomeSchema,
  mpWorldSnapshotSchema,
]);

export type MpServerMessage = z.infer<typeof mpServerMessageSchema>;

/** Default authoritative snapshot rate (Hz) for the first multiplayer slice. */
export const MP_DEFAULT_TICK_HZ = 15;