import { FileText, Sparkles, ShieldCheck, AlertCircle } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
      {/* Workspace Header */}
      <div className="flex flex-col gap-1 border-b border-neutral-800/80 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-100">
            Brand Compliance Workspace
          </h1>
          <p className="text-sm text-neutral-400">
            Draft and refine enterprise copy against active brand guidelines in real time.
          </p>
        </div>
        <div className="mt-3 flex items-center gap-2 sm:mt-0">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-xs text-neutral-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            RAG Grounding: Connected
          </span>
        </div>
      </div>

      {/* Dual-Panel Dashboard Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-[580px]">
        {/* Left Panel: Drafting Workspace */}
        <section
          aria-label="Drafting Panel"
          className="lg:col-span-6 xl:col-span-7 flex flex-col rounded-lg border border-neutral-800 bg-neutral-900/30 overflow-hidden"
        >
          {/* Panel Header */}
          <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-neutral-400" />
              <span className="text-xs font-semibold tracking-wide text-neutral-200">
                Draft Workspace
              </span>
            </div>
            <span className="text-xs text-neutral-500">Plain text / Markdown</span>
          </div>

          {/* Panel Body: Textarea Placeholder */}
          <div className="flex-1 p-4 flex flex-col">
            <div className="flex-1 rounded-md border border-neutral-800 bg-neutral-950/60 p-4 font-mono text-sm text-neutral-400">
              <p className="text-neutral-500 select-none">
                {"// Paste or compose draft campaign copy, blog posts, or product announcements here..."}
              </p>
            </div>

            {/* Bottom Actions Bar */}
            <div className="mt-4 flex items-center justify-between pt-2">
              <span className="text-xs text-neutral-500">
                0 words &bull; 0 characters
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-md bg-neutral-100 px-4 py-2 text-xs font-semibold text-neutral-900 transition-colors hover:bg-neutral-200 active:bg-neutral-300"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Audit Draft</span>
              </button>
            </div>
          </div>
        </section>

        {/* Right Panel: AI Coaching & Explainability Feedback */}
        <section
          aria-label="Compliance and AI Coaching Feedback"
          className="lg:col-span-6 xl:col-span-5 flex flex-col rounded-lg border border-neutral-800 bg-neutral-900/30 overflow-hidden"
        >
          {/* Panel Header */}
          <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-semibold tracking-wide text-neutral-200">
                Compliance &amp; Coaching
              </span>
            </div>
            <span className="text-xs text-neutral-500">Coach, not a filter</span>
          </div>

          {/* Panel Body: Empty / Placeholder State */}
          <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900/80 text-neutral-400 mb-4">
              <AlertCircle className="h-6 w-6 text-neutral-400" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-200">
              Awaiting Draft for Audit
            </h3>
            <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-neutral-400">
              Run an audit to view real-time compliance scoring, guideline citations, and 1-click suggested fixes.
            </p>

            {/* Visual Guide Card Placeholder */}
            <div className="mt-6 w-full rounded-md border border-neutral-800/80 bg-neutral-950/40 p-3.5 text-left">
              <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-2">
                <span className="font-medium text-neutral-300">Violation Card Structure</span>
                <span className="text-neutral-500">Preview</span>
              </div>
              <ul className="space-y-1.5 text-xs text-neutral-400">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-600" />
                  <span>Flagged Snippet highlighting</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-600" />
                  <span>Direct citation from brand book</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-600" />
                  <span>Coaching rationale &amp; 1-Click fix</span>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
