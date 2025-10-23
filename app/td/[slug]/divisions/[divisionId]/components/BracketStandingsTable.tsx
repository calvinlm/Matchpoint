"use client";

import React from "react";
import { motion } from "framer-motion";
import { useBracketStandings } from "@/frontend/hooks/useBrackets";
import { validateBracketConfig } from "src/brackets/configValidation";

interface Props {
  slug: string;
  bracketId: string;
  token?: string;
  groups: number; // 🆕 number of bracket groups (default = 1)
}

interface StandingRow {
  teamId: string;
  teamName: string;
  entryCode: string | null;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  quotient: number;
  rank: number;
}

export function BracketStandingsTable({ slug, bracketId, token, groups }: Props) {
  const { data, isLoading, isError, error } = useBracketStandings(slug, bracketId, token);
  console.log("STANDINGS DATA:", data);
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

  if (!data || !data.standings || data.standings.length === 0) {
    return null;
  }

  const standings = data.standings as StandingRow[];
  const groupedStandings: Record<string, StandingRow[]> = {};

  // 🧩 Split evenly into groups if there are multiple
  if (groups > 1) {
    const groupSize = Math.ceil(standings.length / groups);
    for (let i = 0; i < groups; i++) {
      const groupLetter = String.fromCharCode(65 + i); // 65 = 'A'
      groupedStandings[groupLetter] = standings.slice(i * groupSize, (i + 1) * groupSize);
    }
  } else {
    groupedStandings["A"] = standings;
  }

  const groupKeys = Object.keys(groupedStandings);

  const StandingsTable = ({ rows }: { rows: StandingRow[] }) => (
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
              <td className="px-3 py-2 text-right text-slate-700">
                {row.quotient.toFixed(4)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <section className="space-y-8">
      {groupKeys.length === 1 ? (
        // 🅰 Single Group
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-3"
        >
          <header>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
              Standings
            </h4>
          </header>
          <StandingsTable rows={groupedStandings[groupKeys[0]]} />
        </motion.div>
      ) : (
        // 🅰🅱 Multiple Groups
        groupKeys.map((groupKey, idx) => (
          <motion.div
            key={groupKey}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.1 }}
            className="space-y-3 border-t border-slate-200 pt-4"
          >
            <header>
              <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                Standings — Bracket {groupKey}
              </h4>
            </header>
            <StandingsTable rows={groupedStandings[groupKey]} />
          </motion.div>
        ))
      )}
    </section>
  );
}
