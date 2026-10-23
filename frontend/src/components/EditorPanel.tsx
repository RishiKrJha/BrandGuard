"use client";

import React, { useCallback, useId } from "react";
import {
  FileText,
  Sparkles,
  Loader2,
  Trash2,
  CornerDownLeft,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface EditorPanelProps {
  value: string;
  onChange: (value: string) => void;
  onAudit: () => void;
  isLoading: boolean;
  onSelectSample?: (sampleText: string) => void;
  className?: string;
}

export const SAMPLE_DRAFTS = [
  {
    label: "Over-promising Claims",
    description: "Contains absolute guarantees and competitor bashing",
    content:
      "We guarantee 100% bug-free software that crushes the competition every single time. Sign up today to secure the cheapest deal on the enterprise cloud market with zero risk whatsoever.",
  },
  {
    label: "Informal Social Tone",
    description: "Contains overly casual slang and hyperbolic language",
    content:
      "Hey guys! Our killer new AI platform is totally insane. Don't miss out on this crazy discount before it's gone forever — you'll literally regret not buying it right now!",
  },
  {
    label: "On-Brand Enterprise",
    description: "Balanced, authoritative, and compliant copy",
    content:
      "BrandGuard empowers distributed marketing teams to maintain continuous guideline compliance. With RAG-grounded evaluation and 1-click coaching fixes, enterprise organizations safeguard brand trust across every public touchpoint.",
  },
];

export function EditorPanel({
  value,
  onChange,
  onAudit,
  isLoading,
  onSelectSample,
  className,
}: EditorPanelProps) {
  const textareaId = useId();

  // Derived metrics calculated during render (rerender-derived-state-no-effect)
  const trimmed = value.trim();
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
  const charCount = value.length;
  const estimatedReadingTime = Math.max(1, Math.ceil(wordCount / 200));
  const isDraftEmpty = trimmed.length === 0;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // ⌘+Enter or Ctrl+Enter to trigger audit
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (!isLoading && !isDraftEmpty) {
          onAudit();
        }
      }
    },
    [isLoading, isDraftEmpty, onAudit]
  );

  const handleClear = useCallback(() => {
    onChange("");
  }, [onChange]);

  return (
    <section
      aria-label="Draft Editor Panel"
      className={cn(
        "flex flex-col rounded-xl border border-neutral-800 bg-neutral-900/40 backdrop-blur-sm shadow-xl shadow-black/20 overflow-hidden min-h-[580px]",
        className
      )}
    >
      {/* Panel Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800/60 bg-gradient-to-r from-neutral-950 via-neutral-900/80 to-neutral-950 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-neutral-800 bg-neutral-950 text-neutral-400">
            <FileText className="h-3.5 w-3.5 text-neutral-300" />
          </div>
          <div>
            <h2 className="text-xs font-semibold tracking-wide text-neutral-200 uppercase">
              Draft Workspace
            </h2>
            <p className="text-[11px] text-neutral-500">
              Input copy for AI brand and tone evaluation
            </p>
          </div>
        </div>

        {/* Quick Sample Selector & Actions */}
        <div className="flex items-center gap-2">
          {onSelectSample ? (
            <div className="relative inline-block">
              <label htmlFor="sample-selector" className="sr-only">
                Insert Sample Draft
              </label>
              <select
                id="sample-selector"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    onSelectSample(e.target.value);
                    e.target.value = "";
                  }
                }}
                disabled={isLoading}
                className="h-7 cursor-pointer appearance-none rounded-md border border-neutral-800 bg-neutral-950 px-2.5 pr-7 text-[11px] font-medium text-neutral-400 transition-colors hover:border-neutral-700 hover:text-neutral-200 focus:border-neutral-700 focus:outline-none disabled:opacity-50"
              >
                <option value="" disabled>
                  Load Sample Draft...
                </option>
                {SAMPLE_DRAFTS.map((sample) => (
                  <option key={sample.label} value={sample.content}>
                    {sample.label}
                  </option>
                ))}
              </select>
              <BookOpen className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-neutral-500" />
            </div>
          ) : null}

          {!isDraftEmpty ? (
            <button
              type="button"
              onClick={handleClear}
              disabled={isLoading}
              title="Clear draft text"
              aria-label="Clear draft text"
              className="inline-flex h-7 items-center gap-1 rounded-md border border-neutral-800 bg-neutral-950 px-2 text-[11px] font-medium text-neutral-400 transition-colors hover:border-neutral-700 hover:text-rose-400 disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Editor Main Content Area */}
      <div className="relative flex-1 flex flex-col p-4 bg-neutral-950/40">
        <label htmlFor={textareaId} className="sr-only">
          Draft Copy Input
        </label>
        <textarea
          id={textareaId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          rows={16}
          placeholder="Paste or write your marketing copy, social post, campaign headline, or product update here...&#10;&#10;Press ⌘ + Enter or click 'Audit Draft' to check tone, claims, and brand compliance against your active guidelines."
          className="flex-1 w-full resize-none rounded-lg border border-neutral-800/80 bg-neutral-950/70 p-4 font-mono text-sm leading-relaxed text-neutral-100 placeholder:text-neutral-600 transition-colors focus:border-neutral-700 focus:outline-none focus:ring-1 focus:ring-neutral-700 disabled:opacity-70 disabled:cursor-not-allowed selection:bg-emerald-900/50 selection:text-emerald-100"
          spellCheck="false"
        />
      </div>

      {/* Panel Bottom Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-neutral-800/90 bg-neutral-900/60 px-4 py-3">
        {/* Metric counters */}
        <div className="flex items-center gap-3 text-xs text-neutral-500">
          <span className="tabular-nums">
            <strong className="font-semibold text-neutral-300">
              {wordCount}
            </strong>{" "}
            {wordCount === 1 ? "word" : "words"}
          </span>
          <span className="text-neutral-700">•</span>
          <span className="tabular-nums">
            <strong className="font-semibold text-neutral-300">
              {charCount}
            </strong>{" "}
            {charCount === 1 ? "char" : "chars"}
          </span>
          {wordCount > 0 ? (
            <>
              <span className="text-neutral-700">•</span>
              <span className="text-neutral-500">
                ~{estimatedReadingTime} min read
              </span>
            </>
          ) : null}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 justify-end">
          <span className="hidden lg:inline-flex items-center gap-1 text-[11px] text-neutral-500">
            <CornerDownLeft className="h-3 w-3" />
            <span>⌘ + Enter to audit</span>
          </span>

          <button
            type="button"
            onClick={onAudit}
            disabled={isLoading || isDraftEmpty}
            className={cn(
              "relative inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2 focus:ring-offset-neutral-950",
              isLoading
                ? "bg-neutral-800 text-neutral-400 cursor-not-allowed"
                : isDraftEmpty
                ? "bg-neutral-800/60 text-neutral-500 cursor-not-allowed border border-neutral-800"
                : [
                    "bg-neutral-100 text-neutral-950",
                    "shadow-md shadow-neutral-950/40",
                    "hover:bg-white hover:shadow-[0_0_18px_rgba(255,255,255,0.10)]",
                    "active:bg-neutral-200 active:scale-[0.97]",
                  ]
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-400" />
                <span>Auditing Draft...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 text-neutral-950" />
                <span>Audit Draft</span>
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}

