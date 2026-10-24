"use client";

/**
 * AuditWorkspace — Client Component
 *
 * Contains all interactive state (audit triggers, fix application, error
 * handling) for the dual-panel brand compliance workspace. Kept as a
 * dedicated client component so the parent page.tsx can remain a Server
 * Component, enabling RSC streaming and reducing the client JS bundle.
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Database, RefreshCw, SlidersHorizontal } from "lucide-react";
import { EditorPanel, SAMPLE_DRAFTS } from "@/components/EditorPanel";
import { FeedbackPanel } from "@/components/FeedbackPanel";
import { GuidelineModal } from "@/components/GuidelineModal";
import {
  auditApi,
  guidelinesApi,
  type AuditResponse,
  type Violation,
  type GuidelineStatsResponse,
  ApiError,
} from "@/lib/api";

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function AuditWorkspace() {
  const [draftText, setDraftText] = useState<string>(SAMPLE_DRAFTS[0].content);
  const [auditResult, setAuditResult] = useState<AuditResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fixedViolationIds, setFixedViolationIds] = useState<Set<string>>(
    () => new Set()
  );
  const [lastAuditedDraft, setLastAuditedDraft] = useState<string | null>(null);
  const [isGuidelineModalOpen, setIsGuidelineModalOpen] = useState<boolean>(false);
  const [guidelineStats, setGuidelineStats] = useState<GuidelineStatsResponse | null>(null);

  // Ref to track and cancel in-flight audit requests
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchGuidelineStats = useCallback(async () => {
    try {
      const stats = await guidelinesApi.getStats();
      setGuidelineStats(stats);
    } catch {
      // Backend may be booting
    }
  }, []);

  // Fetch initial stats and cancel in-flight requests on unmount
  useEffect(() => {
    let ignore = false;
    guidelinesApi
      .getStats()
      .then((stats) => {
        if (!ignore) {
          setGuidelineStats(stats);
        }
      })
      .catch(() => {
        // Backend may be booting
      });

    return () => {
      ignore = true;
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleGuidelinesUpdated = useCallback(() => {
    fetchGuidelineStats();
    // Invalidate last audit result since rules have changed
    setAuditResult(null);
    setLastAuditedDraft(null);
    setFixedViolationIds(new Set());
  }, [fetchGuidelineStats]);

  // Derived state (rerender-derived-state-no-effect)
  const isDirty =
    lastAuditedDraft !== null &&
    lastAuditedDraft.trim() !== draftText.trim();

  // Audit trigger handler
  const handleAudit = useCallback(async () => {
    const trimmed = draftText.trim();
    if (!trimmed || isLoading) return;

    // Abort any in-flight request before starting a new one
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const response = await auditApi.scan(
        { draft_text: trimmed },
        { signal: controller.signal },
      );
      setAuditResult(response);
      setFixedViolationIds(new Set());
      setLastAuditedDraft(trimmed);
    } catch (err: unknown) {
      // Ignore intentional request cancellations
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (err instanceof ApiError) {
        setError(err.detail);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(
          "Failed to connect to the brand audit service. Please ensure the backend is running."
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [draftText, isLoading]);

  // 1-Click Apply Fix handler: updates draftText and marks violation as fixed
  const handleApplyFix = useCallback((violation: Violation) => {
    setDraftText((current) => {
      const target = violation.flagged_text.trim();
      if (!target) return current;

      try {
        const regex = new RegExp(escapeRegExp(target), "gi");
        if (regex.test(current)) {
          return current.replace(regex, violation.suggested_fix);
        }
      } catch {
        if (current.includes(target)) {
          return current.replace(target, violation.suggested_fix);
        }
      }
      return current;
    });

    setFixedViolationIds((prev) => {
      const updated = new Set(prev);
      updated.add(violation.id);
      return updated;
    });
  }, []);

  const handleSelectSample = useCallback((sampleText: string) => {
    setDraftText(sampleText);
    setError(null);
    setAuditResult(null);
    setFixedViolationIds(new Set());
    setLastAuditedDraft(null);
  }, []);

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
      {/* Workspace Header */}
      <div className="flex flex-col gap-2 border-b border-neutral-800/80 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-neutral-100">
              Brand Compliance Workspace
            </h1>
            <span className="rounded border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
              v1.0
            </span>
          </div>
          <p className="mt-0.5 text-xs text-neutral-400">
            Audit copy against official brand guidelines with RAG-grounded AI
            coaching and 1-click fixes.
          </p>
        </div>

        {/* Status Indicators */}
        <div className="flex flex-wrap items-center gap-2">
          {isDirty ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">
              <RefreshCw className="h-3 w-3 animate-pulse" />
              <span>Draft modified &bull; Re-audit needed</span>
            </span>
          ) : null}

          <div className="inline-flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900/80 px-2.5 py-1 text-xs text-neutral-300">
            <Database className="h-3.5 w-3.5 text-neutral-400" />
            <span className="text-neutral-400">RAG Vector Store:</span>
            <span className="flex items-center gap-1.5 font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
              ChromaDB Connected
            </span>
          </div>

          <button
            onClick={() => setIsGuidelineModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900/90 hover:bg-neutral-800/80 hover:border-neutral-700 px-2.5 py-1 text-xs text-neutral-200 transition-all active:scale-[0.98]"
            title="Upload, view, or reset official brand guidelines in ChromaDB"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-400" />
            <span>Manage Guidelines</span>
            {guidelineStats ? (
              <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-mono text-neutral-300">
                {guidelineStats.total_chunks} chunks
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {/* Dual-Panel Layout (Left 60%, Right 40% on Desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
        {/* Left Panel: Content Drafting Workspace (60% width) */}
        <EditorPanel
          value={draftText}
          onChange={setDraftText}
          onAudit={handleAudit}
          isLoading={isLoading}
          onSelectSample={handleSelectSample}
          className="lg:col-span-7 xl:col-span-7"
        />

        {/* Right Panel: Explainable AI Coaching & Violations (40% width) */}
        <FeedbackPanel
          auditResult={auditResult}
          isLoading={isLoading}
          error={error}
          onApplyFix={handleApplyFix}
          fixedViolationIds={fixedViolationIds}
          onRetry={handleAudit}
          className="lg:col-span-5 xl:col-span-5"
        />
      </div>

      {/* Guideline Management Modal */}
      <GuidelineModal
        isOpen={isGuidelineModalOpen}
        onClose={() => setIsGuidelineModalOpen(false)}
        onGuidelinesUpdated={handleGuidelinesUpdated}
      />
    </div>
  );
}
