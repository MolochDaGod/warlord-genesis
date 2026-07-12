/**
 * Same-origin fleet API helpers — Railway via Vercel rewrites.
 * Auth: Bearer grudge_auth_token (Grudge ID) when present.
 */
import { getStudioToken } from "./grudgeStudio";

export function fleetAuthHeaders(extra: Record<string, string> = {}): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...extra,
  };
  const token = getStudioToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function fleetGet<T = unknown>(path: string): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  try {
    const res = await fetch(path.startsWith("/") ? path : `/${path}`, {
      headers: fleetAuthHeaders(),
      credentials: "include",
    });
    const data = (await res.json().catch(() => null)) as T | null;
    if (!res.ok) {
      const err =
        data && typeof data === "object" && data !== null && "error" in data
          ? String((data as { error?: string }).error)
          : `HTTP ${res.status}`;
      return { ok: false, status: res.status, data, error: err };
    }
    return { ok: true, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: null, error: e instanceof Error ? e.message : "Network error" };
  }
}

export async function fleetPost<T = unknown>(
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  try {
    const res = await fetch(path.startsWith("/") ? path : `/${path}`, {
      method: "POST",
      headers: fleetAuthHeaders({ "Content-Type": "application/json" }),
      credentials: "include",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => null)) as T | null;
    if (!res.ok) {
      const err =
        data && typeof data === "object" && data !== null && "error" in data
          ? String((data as { error?: string }).error)
          : `HTTP ${res.status}`;
      return { ok: false, status: res.status, data, error: err };
    }
    return { ok: true, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: null, error: e instanceof Error ? e.message : "Network error" };
  }
}
