"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Upload,
  FileText,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Database,
  RefreshCw,
  FileUp,
} from "lucide-react";
import {
  guidelinesApi,
  type GuidelineStatsResponse,
  ApiError,
} from "@/lib/api";

interface GuidelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGuidelinesUpdated?: () => void;
}

export function GuidelineModal({
  isOpen,
  onClose,
  onGuidelinesUpdated,
}: GuidelineModalProps) {
  const [stats, setStats] = useState<GuidelineStatsResponse | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);
  const [deletingFilename, setDeletingFilename] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Reset state and close modal
  const handleClose = useCallback(() => {
    setUploadSuccess(null);
    setUploadError(null);
    setSelectedFile(null);
    setConfirmReset(false);
    onClose();
  }, [onClose]);

  // Fetch stats when modal opens
  const fetchStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const data = await guidelinesApi.getStats();
      setStats(data);
    } catch {
      // Fallback
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let ignore = false;
    guidelinesApi
      .getStats()
      .then((data) => {
        if (!ignore) {
          setStats(data);
        }
      })
      .catch(() => {});

    return () => {
      ignore = true;
    };
  }, [isOpen]);

  // Handle ESC key press to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  // File selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      validateAndSetFile(file);
    }
  };

  const validateAndSetFile = (file: File) => {
    setUploadSuccess(null);
    setUploadError(null);

    const validExtensions = [".pdf", ".txt", ".md"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!validExtensions.includes(ext)) {
      setUploadError("Invalid file type. Please upload a .pdf, .txt, or .md file.");
      setSelectedFile(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File exceeds 10MB limit.");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  // Drag and Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  // Upload handler
  const handleUpload = async () => {
    if (!selectedFile || isUploading) return;
    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const res = await guidelinesApi.upload(selectedFile);
      setUploadSuccess(
        `Successfully indexed "${res.filename}" (${res.chunks_indexed} new chunks). Total: ${res.total_chunks} chunks.`
      );
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchStats();
      onGuidelinesUpdated?.();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setUploadError(err.detail);
      } else if (err instanceof Error) {
        setUploadError(err.message);
      } else {
        setUploadError("Failed to upload and index document.");
      }
    } finally {
      setIsUploading(false);
    }
  };

  // Delete individual file
  const handleDeleteFile = async (filename: string) => {
    if (deletingFilename) return;
    setDeletingFilename(filename);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      await guidelinesApi.deleteFile(filename);
      setUploadSuccess(`Deleted "${filename}".`);
      await fetchStats();
      onGuidelinesUpdated?.();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setUploadError(err.detail);
      } else {
        setUploadError(`Failed to delete "${filename}".`);
      }
    } finally {
      setDeletingFilename(null);
    }
  };

  // Reset all guidelines handler
  const handleReset = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }

    setIsResetting(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      await guidelinesApi.reset();
      setConfirmReset(false);
      setUploadSuccess("All brand guidelines have been cleared. Vector store is reset.");
      await fetchStats();
      onGuidelinesUpdated?.();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setUploadError(err.detail);
      } else {
        setUploadError("Failed to reset guidelines vector store.");
      }
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-neutral-950 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800/80 bg-neutral-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-100 tracking-tight">
                Brand Guidelines Knowledge Base
              </h2>
              <p className="text-xs text-neutral-400">
                Manage official brand documents indexed into ChromaDB for RAG evaluation.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-200 rounded-md hover:bg-neutral-800/60 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Status & Active Documents */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-neutral-300">Active Knowledge Base</span>
                <button
                  onClick={fetchStats}
                  disabled={isLoadingStats}
                  className="text-neutral-500 hover:text-neutral-300 transition-colors"
                  title="Refresh stats"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingStats ? "animate-spin" : ""}`} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-800 text-neutral-300 border border-neutral-700/60">
                  {stats ? `${stats.total_chunks} chunks indexed` : "Loading..."}
                </span>
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
                  {stats?.status === "operational" ? "Operational" : "Connected"}
                </span>
              </div>
            </div>

            {/* Document list */}
            {stats?.sources && stats.sources.length > 0 ? (
              <div className="space-y-1.5 pt-1">
                <p className="text-[11px] text-neutral-400">Indexed Guideline Documents:</p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {stats.sources.map((src) => (
                    <div
                      key={src}
                      className="flex items-center justify-between px-3 py-2 rounded-md bg-neutral-900/90 border border-neutral-800 hover:border-neutral-700/80 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span className="text-neutral-200 font-mono text-[11px] truncate">
                          {src}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteFile(src)}
                        disabled={deletingFilename === src}
                        className="p-1 text-neutral-500 hover:text-rose-400 transition-colors rounded hover:bg-neutral-800 shrink-0"
                        title={`Remove ${src}`}
                      >
                        {deletingFilename === src ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-3 text-center text-neutral-400 border border-dashed border-neutral-800/80 rounded-md">
                <p className="text-[11px]">No custom guidelines uploaded yet.</p>
                <p className="text-[10px] text-neutral-400 mt-0.5">
                  Audits will return 100% adherence until official guidelines are uploaded.
                </p>
              </div>
            )}
          </div>

          {/* Upload New Guideline Section */}
          <div className="space-y-3">
            <label className="block text-xs font-medium text-neutral-200">
              Upload New Brand Guideline
            </label>

            {/* Drag & Drop Area */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-all duration-150 ${
                isDragging
                  ? "border-emerald-500 bg-emerald-500/5 text-emerald-300"
                  : selectedFile
                  ? "border-neutral-700 bg-neutral-900/60 text-neutral-200"
                  : "border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/30 text-neutral-400"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md"
                onChange={handleFileChange}
                className="hidden"
              />

              {selectedFile ? (
                <div className="flex items-center justify-center gap-2">
                  <FileUp className="w-5 h-5 text-emerald-400" />
                  <div className="text-left">
                    <p className="font-medium text-neutral-100 text-xs truncate max-w-xs">
                      {selectedFile.name}
                    </p>
                    <p className="text-[10px] text-neutral-400">
                      {(selectedFile.size / 1024).toFixed(1)} KB &bull; Click or drop another file to replace
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5">
                  <Upload className="w-5 h-5 text-neutral-400" />
                  <p className="text-xs font-medium text-neutral-300">
                    Click to browse or drag & drop brand rules
                  </p>
                  <p className="text-[10px] text-neutral-400">
                    Supported formats: PDF, Markdown (.md), Plain Text (.txt) up to 10MB
                  </p>
                </div>
              )}
            </div>

            {/* Action buttons */}
            {selectedFile && (
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  disabled={isUploading}
                  className="px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 rounded border border-neutral-800 hover:bg-neutral-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-all shadow-[0_0_12px_rgba(16,185,129,0.2)] disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Parsing & Indexing...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload & Index Document</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Upload notifications */}
            {uploadSuccess && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="text-xs leading-relaxed">{uploadSuccess}</span>
              </div>
            )}

            {uploadError && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="text-xs leading-relaxed">{uploadError}</span>
              </div>
            )}
          </div>

          {/* Danger Zone: Reset Knowledge Base */}
          <div className="pt-4 border-t border-neutral-800/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-neutral-800/80 bg-neutral-900/20">
              <div>
                <h3 className="text-xs font-medium text-neutral-200">
                  Reset Vector Knowledge Base
                </h3>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Wipes all guideline chunks from ChromaDB for demo or testing new brands.
                </p>
              </div>

              {confirmReset ? (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setConfirmReset(false)}
                    disabled={isResetting}
                    className="px-2.5 py-1 text-xs text-neutral-400 hover:text-neutral-200 rounded border border-neutral-800 hover:bg-neutral-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReset}
                    disabled={isResetting}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-rose-600 hover:bg-rose-500 text-white rounded transition-colors shadow-[0_0_12px_rgba(225,29,72,0.3)]"
                  >
                    {isResetting ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                    <span>Confirm Wipe All</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  disabled={isResetting || !stats || stats.total_chunks === 0}
                  className="px-3 py-1.5 text-xs text-neutral-400 hover:text-rose-300 rounded border border-neutral-800 hover:border-rose-900/50 hover:bg-rose-950/20 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  Reset Knowledge Base
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-neutral-800/80 bg-neutral-900/40 flex justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-1.5 text-xs font-medium text-neutral-200 hover:text-white bg-neutral-800 hover:bg-neutral-700/80 rounded transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

