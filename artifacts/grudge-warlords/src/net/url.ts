// Derive the realtime WebSocket URL from the current page location so the same
// build works in dev, preview, and production with no configuration. The API
// (and its /api/realtime socket) is served through the shared proxy on the same
// host as the web app, so we only swap the scheme.
export function realtimeUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/api/realtime`;
}
