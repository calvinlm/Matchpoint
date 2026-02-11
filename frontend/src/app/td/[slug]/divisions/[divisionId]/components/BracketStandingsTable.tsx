"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useBracketStandings } from "@/hooks/useBrackets";
import { Button } from "@/components/ui/button";

interface Props {
  slug: string;
  bracketId: string;
  token?: string;
}

interface StandingRow {
  teamId: string;
  teamName: string;
  entryCode: string | null;
  seed?: number | null;
  groupIndex?: number | null;
  groupKey?: string | null;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  quotient: number;
  rank: number;
}

function groupLabelFromIndex(index: number) {
  return `Group ${String.fromCharCode(65 + index)}`;
}

export function BracketStandingsTable({ slug, bracketId, token }: Props) {
  const { data, isLoading, isError, error } = useBracketStandings(slug, bracketId, token);

  const groupedStandings = useMemo(() => {
    if (!data?.standings?.length) {
      return [] as Array<{ key: string; rows: StandingRow[] }>;
    }

    const standings = data.standings as StandingRow[];
    const buckets = new Map<number, StandingRow[]>();

    standings.forEach((row) => {
      const idx = row.groupIndex ?? 0;
      const list = buckets.get(idx) ?? [];
      list.push(row);
      buckets.set(idx, list);
    });

    const sorted = Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([index, rows]) => ({
        key: rows[0]?.groupKey || groupLabelFromIndex(index),
        rows: [...rows].sort((a, b) => a.rank - b.rank),
      }));

    return sorted;
  }, [data]);

  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"stacked" | "tabs">("stacked");

  if (isLoading) {
    return <div className="text-sm text-slate-500">Loading standings…</div>;
  }

  if (isError) {
    return (
      <div className="text-sm text-red-600">
        Failed to load standings: {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  if (!groupedStandings.length) {
    return null;
  }

  const resolvedActiveGroup =
    activeGroupKey && groupedStandings.some((group) => group.key === activeGroupKey)
      ? activeGroupKey
      : groupedStandings[0].key;

  const StandingsTable = ({ rows }: { rows: StandingRow[] }) => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2">Rank</th>
            <th className="px-3 py-2">Team</th>
            <th className="px-3 py-2 text-right">W</th>
            <th className="px-3 py-2 text-right">L</th>
            <th className="px-3 py-2 text-right">PF</th>
            <th className="px-3 py-2 text-right">PA</th>
            <th className="px-3 py-2 text-right">Quotient</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row) => {
            const teamLabel = row.entryCode
              ? `${row.entryCode} · ${row.teamName}`
              : row.teamName;

            return (
              <tr key={row.teamId}>
                <td className="px-3 py-2 font-medium text-slate-700">{row.rank}</td>
                <td className="px-3 py-2 text-slate-700">{teamLabel}</td>
                <td className="px-3 py-2 text-right text-slate-700">{row.wins}</td>
                <td className="px-3 py-2 text-right text-slate-700">{row.losses}</td>
                <td className="px-3 py-2 text-right text-slate-700">{row.pointsFor}</td>
                <td className="px-3 py-2 text-right text-slate-700">{row.pointsAgainst}</td>
                <td className="px-3 py-2 text-right text-slate-700">{row.quotient.toFixed(4)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const visibleGroups =
    groupedStandings.length <= 1 || viewMode === "stacked"
      ? groupedStandings
      : groupedStandings.filter((group) => group.key === resolvedActiveGroup);

  return (
    <section className="space-y-6">
      {groupedStandings.length > 1 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={viewMode === "stacked" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("stacked")}
            >
              Stacked
            </Button>
            <Button
              variant={viewMode === "tabs" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("tabs")}
            >
              Tabs
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {groupedStandings.map((group) => (
              <Button
                key={group.key}
                variant={resolvedActiveGroup === group.key ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setActiveGroupKey(group.key);
                  setViewMode("tabs");
                }}
              >
                {group.key}
              </Button>
            ))}
          </div>
        </div>
      )}

      {visibleGroups.map((group, idx) => (
        <motion.div
          key={group.key}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: idx * 0.05 }}
          className="space-y-3 rounded-md border border-slate-200 p-4"
        >
          <header>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
              Standings — {group.key}
            </h4>
          </header>
          <StandingsTable rows={group.rows} />
        </motion.div>
      ))}
    </section>
  );
}
