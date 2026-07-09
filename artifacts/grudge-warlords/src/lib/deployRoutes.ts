/** Canonical Warcamp / march-orders route (grudgewarlords.com/deploy). */
export const DEPLOY_PATH = "/deploy";

export function deployUrl(origin?: string): string {
  const base = (origin ?? "").replace(/\/$/, "");
  return `${base}${DEPLOY_PATH}`;
}