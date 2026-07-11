import { Component, type ErrorInfo, type ReactNode } from "react";

export function WebGLFallback({ reason }: { reason?: string }) {
  return (
    <div className="gw-screen">
      <div className="gw-screen-inner">
        <span className="gw-brand-sub">RENDERER OFFLINE</span>
        <h1 className="gw-brand-title">NO<span>SIGNAL</span></h1>
        <p className="gw-intro">
          Grudge Warlords needs WebGL to render its 3D arena, but it could not start on this device.
          {reason ? ` (${reason})` : ""}
        </p>
        <div className="gw-controls-grid" style={{ gridTemplateColumns: "1fr" }}>
          <div>Required: WebGL / WebGL2 + WebAssembly (Rapier physics)</div>
          <div>Enable hardware acceleration in your browser settings</div>
          <div>Update your graphics drivers, then reload</div>
          <div>Try a recent Chrome, Edge, or Firefox on HTTPS</div>
          <div>Optional: WebGPU improves future paths (not required for /play)</div>
          <div>Build-only: Node ≥ 20 + pnpm 9 (not needed in the browser)</div>
        </div>
        <button className="gw-btn" onClick={() => window.location.reload()}>
          RELOAD
        </button>
      </div>
    </div>
  );
}

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  message?: string;
}

// Catches render-time errors from the 3D tree (including WebGL context failures)
// so the player sees a clear fallback instead of a crash overlay.
export class CanvasErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[grudge-warlords] renderer error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return <WebGLFallback reason={this.state.message} />;
    }
    return this.props.children;
  }
}
