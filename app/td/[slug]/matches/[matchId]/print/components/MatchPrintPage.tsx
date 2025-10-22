"use client";

import React from "react";
import Link from "next/link";
import { useMatchDetail } from "@/frontend/hooks/useMatchDetail";

type Props = {
  slug: string;
  matchId: string;
};

function PlayersList({
  label,
  entryCode,
  players,
}: {
  label: string;
  entryCode: string | null;
  players: Array<{ id: string | null; firstName: string | null; lastName: string | null; dateOfBirth: string | null }>;
}) {
  return (
    <section className="space-y-2">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{label}</h2>
        {entryCode && <span className="text-sm font-medium text-slate-600">Entry Code: {entryCode}</span>}
      </header>
      <ul className="space-y-1 text-sm text-slate-700">
        {players.length === 0 && <li className="italic text-slate-400">No players listed</li>}
        {players.map((player, index) => (
          <li key={player.id ?? index}>
            {(player.firstName ?? "").trim()} {(player.lastName ?? "").trim()}
            {player.dateOfBirth && (
              <span className="ml-2 text-xs text-slate-400">{new Date(player.dateOfBirth).toLocaleDateString()}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function MatchPrintPage({ slug, matchId }: Props) {
  const { data, isLoading, isError, error } = useMatchDetail(slug, matchId);

  React.useEffect(() => {
    if (!isLoading && data) {
      const timer = window.setTimeout(() => {
        window.print();
      }, 300);

      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, [isLoading, data]);

  if (isLoading) {
    return <div className="p-6 text-sm text-slate-500">Loading match sheet…</div>;
  }

  if (isError || !data) {
    return (
      <div className="p-6 space-y-4">
        <p className="text-sm text-red-600">
          Failed to load match: {error instanceof Error ? error.message : "Unknown error"}
        </p>
        <Link
          href={`/td/${slug}`}
          className="inline-block rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        >
          Back to tournament
        </Link>
      </div>
    );
  }

  const gamesToRender = Math.max(3, Number(data.config?.bestOf ?? 3));
  const teamOne = data.team1;
  const teamTwo = data.team2;

  return (
    <main className="mx-auto max-w-3xl space-y-6 bg-white p-6 text-slate-900 print:max-w-none print:p-4">
      <header className="space-y-1 border-b border-dashed border-slate-300 pb-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Match Sheet</p>
        <h1 className="text-2xl font-bold">
          {teamOne?.name ?? "TBD"} vs {teamTwo?.name ?? "TBD"}
        </h1>
        <p className="text-sm text-slate-600">
          Tournament: {slug} • Division: {data.division.name} • Bracket: {data.bracketType.replace(/_/g, " ")}
        </p>
        <p className="text-xs text-slate-500">
          Best of {data.config?.bestOf ?? 3} • Win by {data.config?.winBy2 ? "2" : "1"}
        </p>
        <div className="print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="mt-2 rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            Print
          </button>
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <PlayersList
          label={teamOne?.name ?? "Team 1"}
          entryCode={teamOne?.entryCode ?? null}
          players={teamOne?.players ?? []}
        />
        <PlayersList
          label={teamTwo?.name ?? "Team 2"}
          entryCode={teamTwo?.entryCode ?? null}
          players={teamTwo?.players ?? []}
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Game Scores</h3>
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-slate-500">
              <th className="border border-slate-300 px-2 py-1 text-left">Game</th>
              <th className="border border-slate-300 px-2 py-1 text-left">{teamOne?.name ?? "Team 1"}</th>
              <th className="border border-slate-300 px-2 py-1 text-left">{teamTwo?.name ?? "Team 2"}</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: gamesToRender }, (_, index) => (
              <tr key={`game-${index}`}>
                <td className="border border-slate-300 px-2 py-4 text-sm font-medium text-slate-700">Game {index + 1}</td>
                <td className="border border-slate-300 px-2 py-4 text-lg text-slate-800" />
                <td className="border border-slate-300 px-2 py-4 text-lg text-slate-800" />
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Notes</h3>
          <div className="h-24 rounded border border-slate-300" />
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Signatures</h3>
          <div className="space-y-6">
            <div className="h-12 rounded border border-dashed border-slate-300" />
            <div className="h-12 rounded border border-dashed border-slate-300" />
          </div>
        </div>
      </section>

      <footer className="border-t border-dashed border-slate-300 pt-4 text-xs text-slate-500">
        Match ID: {data.id} • Generated {new Date().toLocaleString()}
      </footer>
    </main>
  );
}
