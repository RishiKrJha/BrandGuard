"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, animate, motion } from "framer-motion";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Wand2,
  BookOpen,
  Quote,
  Check,
  RefreshCw,
  Sparkles,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuditResponse, Violation } from "@/lib/api";

export interface FeedbackPanelProps {
  auditResult: AuditResponse | null;
  isLoading: boolean;
  error: string | null;
  onApplyFix: (violation: Violation) => void;
  fixedViolationIds: Set<string>;
  onRetry?: () => void;
  className?: string;
}

/**
 * Score metadata helper for colors and qualitative indicators
 */
function getScoreMeta(score: number) {
  if (score >= 90) {
    return {
      label: "Excellent Alignment",
      status: "Compliant",
      colorClass: "text-emerald-400",
      strokeClass: "stroke-emerald-500",
      bgClass: "bg-emerald-500/10",
      borderClass: "border-emerald-500/20",
    };
  }
  if (score >= 70) {
    return {
      label: "Moderate Alignment",
      status: "Needs Revision",
      colorClass: "text-amber-400",
      strokeClass: "stroke-amber-500",
      bgClass: "bg-amber-500/10",
      borderClass: "border-amber-500/20",
    };
  }
  return {
    label: "Critical Inconsistencies",
    status: "Non-Compliant",
    colorClass: "text-rose-400",
    strokeClass: "stroke-rose-500",
    bgClass: "bg-rose-500/10",
    borderClass: "border-rose-500/20",
  };
}

/**
 * Severity badge styling helper
 */
function getSeverityBadge(severity: string) {
  const normalized = severity.toLowerCase();
  switch (normalized) {
    case "critical":
      return {
        label: "Critical",
        badgeClass: "bg-rose-950/70 text-rose-300 border-rose-800/80",
        indicatorClass: "bg-rose-400",
      };
    case "high":
      return {
        label: "High Impact",
        badgeClass: "bg-amber-950/70 text-amber-300 border-amber-800/80",
        indicatorClass: "bg-amber-400",
      };
    case "medium":
      return {
        label: "Medium Impact",
        badgeClass: "bg-yellow-950/70 text-yellow-300 border-yellow-800/80",
        indicatorClass: "bg-yellow-400",
      };
    default:
      return {
        label: "Minor",
        badgeClass: "bg-neutral-800 text-neutral-300 border-neutral-700",
        indicatorClass: "bg-neutral-400",
      };
  }
}

/**
 * Circular Score Gauge Component
 *
 * On each new score the number counts up from 0 using framer-motion's
 * animate() utility and the SVG ring draws in simultaneously.
 */
function ComplianceScoreGauge({ score }: { score: number }) {
  const boundedScore = Math.max(0, Math.min(100, Math.round(score)));
  const meta = getScoreMeta(boundedScore);

  // Animated display score — counts up from 0 whenever the score prop changes
  const [displayScore, setDisplayScore] = useState(0);
  useEffect(() => {
    const controls = animate(0, boundedScore, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate(v) {
        setDisplayScore(Math.round(v));
      },
    });
    return controls.stop;
  }, [boundedScore]);

  // SVG circular gauge math: r = 38, circumference ~ 238.76
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  // Derive strokeDashoffset from displayScore so the ring draws in sync with the number
  const strokeDashoffset = circumference - (displayScore / 100) * circumference;

  return (
    <div className="flex items-center gap-4 rounded-lg border border-neutral-800/90 bg-neutral-950/70 p-4">
      {/* SVG Ring */}
      <div className="relative flex-shrink-0 h-20 w-20 flex items-center justify-center">
        <svg
          className="h-20 w-20 -rotate-90 transform"
          viewBox="0 0 92 92"
          aria-hidden="true"
        >
          {/* Background Track */}
          <circle
            cx="46"
            cy="46"
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth="6"
            className="text-neutral-800/80"
          />
          {/* Animated Progress Ring — driven by displayScore so it draws in sync */}
          <circle
            cx="46"
            cy="46"
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={cn(meta.strokeClass)}
          />
        </svg>
        {/* Score Center Value — shows the animated count-up number */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-bold tracking-tight text-neutral-100 tabular-nums">
            {displayScore}
          </span>
          <span className="text-[10px] uppercase font-semibold text-neutral-500">
            Score
          </span>
        </div>
      </div>

      {/* Meta Text */}
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border",
              meta.bgClass,
              meta.borderClass,
              meta.colorClass
            )}
          >
            <span
              className={cn("h-1.5 w-1.5 rounded-full", meta.colorClass)}
            />
            {meta.status}
          </span>
          <span className="text-xs text-neutral-400 font-medium truncate">
            {meta.label}
          </span>
        </div>
        <p className="text-xs text-neutral-400 leading-relaxed">
          {boundedScore >= 90
            ? "Strong adherence to tone, claim boundaries, and voice."
            : boundedScore >= 70
            ? "Moderate guideline adherence. Resolve flagged items below."
            : "Significant deviation from brand guidelines. Revision required."}
        </p>
      </div>
    </div>
  );
}

/**
 * Individual Violation Card
 */
function ViolationCard({
  violation,
  isFixed,
  onApplyFix,
}: {
  violation: Violation;
  isFixed: boolean;
  onApplyFix: (violation: Violation) => void;
}) {
  const severity = getSeverityBadge(violation.severity);

  return (
    <article
      className={cn(
        "flex flex-col rounded-lg border transition-all duration-150 p-4 gap-3.5",
        isFixed
          ? "border-neutral-800/50 bg-neutral-950/30 opacity-75"
          : "border-neutral-800 bg-neutral-950/60 hover:border-neutral-700"
      )}
    >
      {/* Card Header: Type, Severity & Status */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Severity Badge */}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-medium tracking-wide",
              severity.badgeClass
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                severity.indicatorClass
              )}
            />
            {severity.label}
          </span>

          {/* Violation Type */}
          <span className="rounded border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-[11px] font-medium text-neutral-300 capitalize">
            {violation.type}
          </span>
        </div>

        {/* Resolved indicator */}
        {isFixed ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
            <Check className="h-3.5 w-3.5" />
            <span>Fix Applied</span>
          </span>
        ) : null}
      </div>

      {/* Flagged Snippet */}
      <div className="rounded border border-rose-950/60 bg-rose-950/20 p-2.5">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-rose-400 mb-1">
          <AlertCircle className="h-3 w-3" />
          <span>Flagged Snippet</span>
        </div>
        <p className="font-mono text-xs text-rose-200 leading-relaxed">
          &ldquo;{violation.flagged_text}&rdquo;
        </p>
      </div>

      {/* Brand Citation */}
      <div className="rounded border border-neutral-800/80 bg-neutral-900/50 p-2.5">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">
          <BookOpen className="h-3 w-3 text-neutral-400" />
          <span>Brand Rule Citation</span>
        </div>
        <p className="text-xs text-neutral-300 leading-relaxed italic">
          &ldquo;{violation.citation}&rdquo;
        </p>
      </div>

      {/* Explanation / Coaching Rational */}
      <div className="text-xs text-neutral-400 leading-relaxed">
        <span className="font-medium text-neutral-300">Coaching Note: </span>
        {violation.explanation}
      </div>

      {/* Suggested Fix & 1-Click Action */}
      <div className="mt-1 flex flex-col gap-2 rounded-md border border-neutral-800 bg-neutral-900/40 p-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-emerald-400" />
            Suggested Revision
          </span>
          <span className="text-[10px] text-neutral-500">1-click replace</span>
        </div>

        <p className="font-mono text-xs text-emerald-300/90 bg-emerald-950/30 border border-emerald-900/40 rounded p-2 leading-relaxed">
          {violation.suggested_fix}
        </p>

        <button
          type="button"
          onClick={() => onApplyFix(violation)}
          disabled={isFixed}
          aria-label={
            isFixed
              ? "Fix already applied to editor"
              : `Apply fix: replace "${violation.flagged_text}" with "${violation.suggested_fix}"`
          }
          className={cn(
            "mt-1 inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-500/50",
            isFixed
              ? "bg-neutral-800/50 text-neutral-500 cursor-default border border-neutral-800"
              : "bg-emerald-600 text-white hover:bg-emerald-500 active:bg-emerald-700 shadow-sm shadow-emerald-950/40"
          )}
        >
          {isFixed ? (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>Fix Applied</span>
            </>
          ) : (
            <>
              <Wand2 className="h-3.5 w-3.5" />
              <span>Apply Fix</span>
            </>
          )}
        </button>
      </div>
    </article>
  );
}

export function FeedbackPanel({
  auditResult,
  isLoading,
  error,
  onApplyFix,
  fixedViolationIds,
  onRetry,
  className,
}: FeedbackPanelProps) {
  // Sort violations during render (rerender-derived-state-no-effect) so un-fixed and higher-severity appear first
  const violations = auditResult?.violations
    ? [...auditResult.violations].sort((a, b) => {
        const aFixed = fixedViolationIds.has(a.id) ? 1 : 0;
        const bFixed = fixedViolationIds.has(b.id) ? 1 : 0;
        if (aFixed !== bFixed) return aFixed - bFixed;

        const severityOrder: Record<string, number> = {
          critical: 4,
          high: 3,
          medium: 2,
          low: 1,
        };
        const aSev = severityOrder[a.severity.toLowerCase()] || 0;
        const bSev = severityOrder[b.severity.toLowerCase()] || 0;
        return bSev - aSev;
      })
    : [];

  const activeViolationsCount = violations.filter(
    (v) => !fixedViolationIds.has(v.id)
  ).length;

  return (
    <section
      aria-label="Compliance and AI Coaching Feedback"
      className={cn(
        "flex flex-col rounded-xl border border-neutral-800 bg-neutral-900/40 backdrop-blur-sm shadow-xl shadow-black/20 overflow-hidden min-h-[580px]",
        className
      )}
    >
      {/* Panel Top Bar */}
      <div className="flex items-center justify-between border-b border-neutral-800/90 bg-neutral-900/70 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-neutral-800 bg-neutral-950 text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />
          </div>
          <div>
            <h2 className="text-xs font-semibold tracking-wide text-neutral-200 uppercase">
              Brand Compliance Feedback
            </h2>
            <p className="text-[11px] text-neutral-500">Coach, not a filter</p>
          </div>
        </div>

        {auditResult ? (
          <span className="rounded-md border border-neutral-800 bg-neutral-950 px-2.5 py-1 text-[11px] font-medium text-neutral-400">
            {activeViolationsCount === 0
              ? "All Clear"
              : `${activeViolationsCount} ${
                  activeViolationsCount === 1 ? "Issue" : "Issues"
                } Pending`}
          </span>
        ) : null}
      </div>

      {/* Main Panel Content Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {/* State 1: Loading State */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
            {/* Concentric emerald pulse rings while Gemini audits */}
            <div className="relative flex h-14 w-14 items-center justify-center">
              <motion.div
                className="absolute inset-0 rounded-full border border-emerald-500/40"
                animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="absolute inset-2 rounded-full border border-emerald-500/25"
                animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0, 0.4] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
              />
              <RefreshCw className="h-5 w-5 text-emerald-400 animate-spin" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-200">
                Evaluating Brand Compliance
              </h3>
              <p className="mt-1 text-xs text-neutral-400 max-w-xs leading-relaxed">
                Retrieving brand chunks from ChromaDB and auditing tone,
                terminology, and claims with Gemini...
              </p>
            </div>
          </div>
        ) : error ? (
          /* State 2: Error State */
          <div className="rounded-lg border border-rose-900/60 bg-rose-950/20 p-5 text-left space-y-3">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <h3 className="text-sm font-semibold">Audit Scan Failed</h3>
            </div>
            <p className="text-xs text-rose-300 leading-relaxed">{error}</p>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 rounded-md border border-rose-800/80 bg-rose-900/40 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-900/60 transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Retry Audit</span>
              </button>
            ) : null}
          </div>
        ) : !auditResult ? (
          /* State 3: Empty State (Awaiting Audit) */
          <div className="flex flex-col items-center justify-center py-12 px-2 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900/60 text-neutral-400 mb-3">
              <ShieldCheck className="h-6 w-6 text-neutral-400" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-200">
              Ready for Compliance Audit
            </h3>
            <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-neutral-400">
              Enter draft copy on the left and click{" "}
              <strong className="text-neutral-300 font-medium">Audit Draft</strong>.
              BrandGuard will inspect the text against your brand book and
              provide real-time explainable coaching.
            </p>

            <div className="mt-6 w-full max-w-sm rounded-lg border border-neutral-800/80 bg-neutral-950/50 p-4 text-left space-y-2.5">
              <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-neutral-400" />
                What BrandGuard inspects
              </span>
              <ul className="space-y-2 text-xs text-neutral-400">
                <li className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                  <span>
                    <strong className="text-neutral-300">Tone & Voice:</strong>{" "}
                    Flags hyperbole, overly casual slang, or out-of-character
                    phrasing.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                  <span>
                    <strong className="text-neutral-300">Claims & Risk:</strong>{" "}
                    Flags unsubstantiated claims and absolute warranties.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                  <span>
                    <strong className="text-neutral-300">Citations:</strong>{" "}
                    Provides exact quotations from your brand guidelines.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        ) : (
          /* State 4: Audit Results Present */
          <div className="space-y-4">
            {/* Circular Compliance Score */}
            <ComplianceScoreGauge score={auditResult.compliance_score} />

            {/* Executive Summary */}
            {auditResult.summary ? (
              <div className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-3.5">
                <div className="flex items-center gap-1.5 text-[10px] uppercase font-semibold text-neutral-400 tracking-wider mb-1.5">
                  <Quote className="h-3 w-3 text-neutral-400" />
                  <span>Executive Coaching Summary</span>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  {auditResult.summary}
                </p>
              </div>
            ) : null}

            {/* Perfect Score / Zero Violations State */}
            {violations.length === 0 ? (
              <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-5 text-center space-y-2">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <h4 className="text-xs font-semibold text-emerald-300">
                  100% Brand Compliant
                </h4>
                <p className="text-xs text-neutral-400 max-w-xs mx-auto leading-relaxed">
                  No guideline violations were detected in this draft. Voice,
                  terminology, and risk boundaries strictly adhere to the brand
                  book.
                </p>
              </div>
            ) : (
              /* Violations Section */
              <div className="space-y-3">
                <div className="flex items-center justify-between pt-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                    Flagged Inconsistencies ({violations.length})
                  </h3>
                  <span className="text-[11px] text-neutral-500">
                    Click &ldquo;Apply Fix&rdquo; to auto-resolve
                  </span>
                </div>

                <div className="space-y-3">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {violations.map((violation) => (
                      <motion.div
                        key={violation.id}
                        layout
                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{
                          opacity: 0,
                          x: 24,
                          scale: 0.96,
                          transition: { duration: 0.18, ease: "easeIn" },
                        }}
                        transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
                      >
                        <ViolationCard
                          violation={violation}
                          isFixed={fixedViolationIds.has(violation.id)}
                          onApplyFix={onApplyFix}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
