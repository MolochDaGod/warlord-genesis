// Grudge account client. Login is Grudge Studio SSO only (`grudgeStudio.ts`).
// getMe/logout restore or close a signed Railway session — no guest mint.

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
  token?: string;
}

export async function getMe(): Promise<GrudgeUser | null> {
  let token: string | null = null;
  try {
    token =
      localStorage.getItem("grudge_auth_token") ||
      localStorage.getItem("sso_token");
  } catch {
    /* ignore */
  }
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${AUTH_BASE}/me`, {
    credentials: "same-origin",
    headers,
  });
  // 401 = not signed in — do not throw
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
