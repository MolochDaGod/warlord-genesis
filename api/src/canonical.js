import crypto from "node:crypto";

const GRUDGE_API =
  process.env.GRUDGE_API_URL?.replace(/\/$/, "") ||
  "https://grudge-api-production-0d46.up.railway.app";

function authHeaders(req, token) {
  const headers = {
    "Content-Type": "application/json",
    "X-Grudge-Client": req.get("X-Grudge-Client") || "warlord-genesis",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers["X-Session-Token"] = token;
  }
  const cookie = req.get("Cookie");
  if (cookie) headers.Cookie = cookie;
  return headers;
}

export async function canonicalGuest(req, deviceId) {
  const guestPuterId = deviceId
    ? `guest_${String(deviceId).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48)}`
    : `guest_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

  const res = await fetch(`${GRUDGE_API}/api/auth/puter`, {
    method: "POST",
    headers: authHeaders(req),
    body: JSON.stringify({
      puterId: guestPuterId,
      displayName: "Guest",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || `Canonical guest failed (${res.status})`);
  }
  return data;
}

export async function canonicalPuterLogin(req, { puterId, displayName, email }) {
  const res = await fetch(`${GRUDGE_API}/api/auth/puter`, {
    method: "POST",
    headers: authHeaders(req),
    body: JSON.stringify({
      puterId,
      puterUuid: puterId,
      displayName,
      email,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || `Puter login failed (${res.status})`);
  }
  return data;
}

export async function canonicalMe(req, token) {
  const res = await fetch(`${GRUDGE_API}/api/auth/me`, {
    method: "GET",
    headers: authHeaders(req, token),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return null;
  return data;
}

export async function canonicalActiveCharacter(req, token) {
  const res = await fetch(`${GRUDGE_API}/api/characters?active=true`, {
    method: "GET",
    headers: authHeaders(req, token),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return null;
  if (Array.isArray(data)) return data[0] ?? null;
  if (data?.characters?.length) return data.characters[0];
  return data?.character ?? data ?? null;
}

export function mapBundleUser(payload, role = "player") {
  const grudgeId =
    payload.grudgeId ||
    payload.grudge_id ||
    payload.user?.grudgeId ||
    payload.user?.grudge_id ||
    "";
  const isGuest =
    role === "guest" ||
    payload.role === "guest" ||
    String(payload.username || "").startsWith("guest_") ||
    String(payload.displayName || "").toLowerCase() === "guest";
  const username =
    payload.username ||
    payload.displayName ||
    payload.user?.username ||
    payload.user?.displayName ||
    "player";
  const displayName =
    payload.displayName ||
    payload.user?.displayName ||
    username;
  const gbux =
    payload.gbuxBalance ??
    payload.gbux ??
    payload.user?.gbuxBalance ??
    payload.balance ??
    0;
  const userId =
    payload.userId ||
    payload.user?.id ||
    payload.id ||
    0;

  return {
    id: Number(userId) || 0,
    username,
    grudgeId,
    displayName,
    avatarUrl: payload.avatarUrl || payload.user?.avatarUrl || null,
    gbuxBalance: String(gbux),
    role: isGuest ? "guest" : role,
    token: payload.token || payload.sessionToken || null,
  };
}

export function mapActiveCharacter(character) {
  if (!character) return null;
  return {
    grudgeId: character.grudgeId || character.grudge_id || character.id,
    raceId: character.race || character.raceId,
    classId: character.heroClass || character.classId || character.class,
    name: character.name || character.displayName,
    modelPath: character.modelPath,
    equipment: character.equipment,
    appearance: character.appearance,
  };
}