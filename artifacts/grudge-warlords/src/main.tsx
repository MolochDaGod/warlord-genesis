import { createRoot } from "react-dom/client";
import { clearSiteDataOnce } from "./lib/clearSiteDataOnce";
import App from "./App";
import "./lib/fonts";
import "./index.css";

// One-shot wipe of stale gw_*/wg-* storage (pre-v68 weak gear saves).
// Flag: localStorage gw_site_data_cleared_v68 — runs once per profile.
clearSiteDataOnce();

createRoot(document.getElementById("root")!).render(<App />);
