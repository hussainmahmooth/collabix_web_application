import { Component, type ReactNode } from "react";
import { Footer } from "./ui";

// A stale deployment chunk or render error must leave a usable recovery screen.
export default class ReleaseBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="auth-page">
        <main className="release-recovery" role="alert">
          <h1>ResearchFlow needs to reload</h1>
          <p>A page could not be opened. Reload to get the current application.</p>
          <p>Any unsaved form entries may need to be entered again.</p>
          <button className="button" onClick={() => window.location.reload()}>
            Reload ResearchFlow
          </button>
        </main>
        <Footer />
      </div>
    );
  }
}
