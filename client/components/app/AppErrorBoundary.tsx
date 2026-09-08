import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error("Application render error", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="min-h-screen bg-[#f6f1e8] px-6 py-16 text-[#111827]">
        <div className="mx-auto max-w-xl rounded-[30px] border border-black/10 bg-[#fffdf8] p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-[#d04745]">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-2xl font-black tracking-[-0.04em]">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#667085]">
            The page could not finish rendering. Reloading usually restores the
            session safely.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#111827] px-5 py-3 text-sm font-black text-white"
          >
            <RefreshCw className="h-4 w-4" /> Reload page
          </button>
        </div>
      </div>
    );
  }
}
