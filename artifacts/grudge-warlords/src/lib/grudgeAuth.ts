// Grudge account client. The primary login is Grudge Studio SSO (see
// `grudgeStudio.ts`). This module keeps the guest path (server-owned, signed
// cookie) plus the shared GrudgeUser shape and the server `getMe`/`logout`
// helpers used to restore/close a guest session.

const AUTH_BASE = "/api/grudge/auth";

export interface GrudgeUser {
  id: number;
  username: string;
  grudgeId: string;
  displayName: string;
  avatarUrl: string | null;
  gbuxBalance: string;
  role: string;
  needsProfile?: boolean;
  isNew?: boolean;
}

async function post(path: string, body?: unknown): Promise<GrudgeUser> {
  const res = await fetch(`${AUTH_BASE}${path}`, {
    method: "POST",
    // X-Grudge-Client marks this as a first-party request; the server rejects
    // auth-mutating POSTs that lack it (CSRF / session-forcing defense).
    headers: { "Content-Type": "application/json", "X-Grudge-Client": "web" },
    body: body ? JSON.stringify(body) : "{}",
    credentials: "same-origin",
  });
  const data = (await res.json()) as GrudgeUser & { error?: string };
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

let deviceId = "";
function getDeviceId(): string {
  if (deviceId) return deviceId;
  try {
    const stored =
      localStorage.getItem("grudge_device_id") ||
      localStorage.getItem("gw_device_id");
    if (stored) {
      deviceId = stored;
      return deviceId;
    }
    deviceId = `gw-${crypto.randomUUID()}`;
    localStorage.setItem("grudge_device_id", deviceId);
    localStorage.setItem("gw_device_id", deviceId);
  } catch {
    deviceId = `gw-${Math.random().toString(36).slice(2)}`;
  }
  return deviceId;
}

export function loginGuest(): Promise<GrudgeUser> {
  return post("/guest", { deviceId: getDeviceId() });
}

export async function getMe(): Promise<GrudgeUser | null> {
  const res = await fetch(`${AUTH_BASE}/me`, { credentials: "same-origin" });
  if (!res.ok) return null;
  return (await res.json()) as GrudgeUser;
}

export async function logout(): Promise<void> {
  await fetch(`${AUTH_BASE}/logout`, {
    method: "POST",
    headers: { "X-Grudge-Client": "web" },
    credentials: "same-origin",
  });
}
