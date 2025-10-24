"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { useTournamentCsv } from "@/frontend/hooks/useTournamentCsv";

type CsvImportExportButtonsProps = {
  slug: string;
};

type FeedbackState = {
  type: "success" | "error";
  message: string;
} | null;

function formatSummary(count: number, label: string) {
  if (count === 0) {
    return null;
  }
  const suffix = count === 1 ? "" : "s";
  return `${count} ${label}${suffix}`;
}

export default function CsvImportExportButtons({ slug }: CsvImportExportButtonsProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { importCsv, exportCsv, isImporting, isExporting } = useTournamentCsv(slug);
  const [feedback, setFeedback] = React.useState<FeedbackState>(null);

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setFeedback(null);

    try {
      const csvText = await file.text();
      const summary = await importCsv(csvText);

      const parts = [
        formatSummary(summary.divisionsCreated, "division"),
        formatSummary(summary.teamsCreated, "team"),
        formatSummary(summary.playersCreated, "player"),
        formatSummary(summary.registrationsCreated, "registration"),
      ].filter((value): value is string => Boolean(value));

      const description = parts.length > 0 ? parts.join(", ") : "No new records";
      setFeedback({ type: "success", message: `Import complete: ${description}.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to import CSV.";
      setFeedback({ type: "error", message });
    } finally {
      resetFileInput();
    }
  };

  const handleExportClick = async () => {
    setFeedback(null);

    try {
      const csv = await exportCsv();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      anchor.download = `${slug}-tournament-export-${timestamp}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
      setFeedback({ type: "success", message: "Export ready. Your download should begin momentarily." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to export CSV.";
      setFeedback({ type: "error", message });
    }
  };

  const isBusy = isImporting || isExporting;

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button type="button" variant="outline" size="sm" onClick={handleImportClick} disabled={isBusy}>
          {isImporting ? "Importing…" : "Import CSV"}
        </Button>
        <Button type="button" size="sm" onClick={handleExportClick} disabled={isBusy}>
          {isExporting ? "Preparing…" : "Export CSV"}
        </Button>
      </div>
      {feedback ? (
        <p
          className={`text-xs ${feedback.type === "error" ? "text-destructive" : "text-muted-foreground"}`}
          aria-live="polite"
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}
