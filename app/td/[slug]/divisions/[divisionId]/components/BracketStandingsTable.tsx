"use client";

import React from "react";
import { useBracketStandings } from "@/frontend/hooks/useBrackets";

interface Props {
  slug: string;
  bracketId: string;
  token?: string;
}

export function BracketStandingsTable({ slug, bracketId, token }: Props) {
  const { data, isLoading, isError, error } = useBracketStandings(slug, bracketId, token);

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

  if (!data || data.standings.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <header>
        <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Standings</h4>
      </header>
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
          {data.standings.map((row) => {
            const teamLabel = row.entryCode ? `${row.entryCode} · ${row.teamName}` : row.teamName;
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
    </section>
  );
}
