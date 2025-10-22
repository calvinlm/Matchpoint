"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicBrackets } from "@/frontend/hooks/usePublicBrackets";

type Props = {
  slug: string;
};

function SeedingsTable({
  seedings,
  kiosk,
}: {
  seedings: Array<{ teamId: string; teamName: string; entryCode: string | null; seed: number }>;
  kiosk: boolean;
}) {
  if (seedings.length === 0) {
    return <p className="text-sm text-slate-500">No seedings applied.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className={`min-w-full divide-y divide-border ${kiosk ? "text-base" : "text-sm"}`}>
        <thead className="bg-muted/60">
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2">Seed</th>
            <th className="px-3 py-2">Team</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {seedings.map((entry) => (
            <tr key={entry.teamId}>
              <td className="px-3 py-2 font-medium text-foreground">{entry.seed}</td>
              <td className="px-3 py-2 text-foreground">
                {entry.entryCode ? `${entry.entryCode} · ${entry.teamName}` : entry.teamName}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupGrid({
  seedings,
  groups,
  kiosk,
}: {
  seedings: Array<{ teamId: string; teamName: string; entryCode: string | null; seed: number }>;
  groups: number;
  kiosk: boolean;
}) {
  if (seedings.length === 0) {
    return <p className="text-sm text-slate-500">Seeding not yet configured.</p>;
  }

  const teamsPerGroup = Math.ceil(seedings.length / groups);
  const buckets: Array<typeof seedings> = [];

  for (let index = 0; index < groups; index += 1) {
    const start = index * teamsPerGroup;
    buckets.push(seedings.slice(start, start + teamsPerGroup));
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {buckets.map((bucket, index) => (
        <div key={`group-${index}`} className="space-y-2">
          <h5 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Group {String.fromCharCode(65 + index)}
          </h5>
          <ul className={`${kiosk ? "text-base" : "text-sm"} space-y-1 text-foreground`}>
            {bucket.length === 0 && <li className="text-muted-foreground">Pending teams</li>}
            {bucket.map((team) => (
              <li key={team.teamId}>
                <span className="font-medium text-muted-foreground">#{team.seed}</span>{" "}
                {team.entryCode ? `${team.entryCode} · ${team.teamName}` : team.teamName}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function MatchesTable({
  matches,
  kiosk,
}: {
  matches: Array<{
    id: string;
    team1: { id: string; name: string; entryCode: string | null } | null;
    team2: { id: string; name: string; entryCode: string | null } | null;
    winnerId: string | null;
    score: unknown;
    status: string;
  }>;
  kiosk: boolean;
}) {
  if (matches.length === 0) {
    return <p className="text-sm text-slate-500">Matches will appear once scheduled.</p>;
  }

  const formatTeam = (team: { name: string; entryCode: string | null } | null, isWinner: boolean) => {
    if (!team) {
      return "TBD";
    }
    const label = team.entryCode ? `${team.entryCode} · ${team.name}` : team.name;
    return isWinner ? <span className="font-semibold text-emerald-700">{label}</span> : label;
  };

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className={`min-w-full divide-y divide-border ${kiosk ? "text-base" : "text-sm"}`}>
        <thead className="bg-muted/60">
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2">Team 1</th>
            <th className="px-3 py-2">Team 2</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {matches.map((match) => (
            <tr key={match.id}>
              <td className="px-3 py-2 text-foreground">
                {formatTeam(match.team1, match.winnerId === match.team1?.id)}
              </td>
              <td className="px-3 py-2 text-foreground">
                {formatTeam(match.team2, match.winnerId === match.team2?.id)}
              </td>
              <td className="px-3 py-2 text-xs font-medium text-muted-foreground">{match.status.toLowerCase()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PublicBracketsPage({ slug }: Props) {
  const searchParams = useSearchParams();
  const kioskParam = searchParams.get("kiosk");
  const kiosk = kioskParam === "1" || kioskParam?.toLowerCase() === "true";

  const { data, isLoading, isError, error, refetch, isFetching } = usePublicBrackets(slug, {
    refetchInterval: kiosk ? 15_000 : undefined,
  });

  if (isLoading) {
    return (
      <main className="mx-auto max-w-5xl space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="mx-auto max-w-4xl space-y-4 p-6">
        <Alert variant="destructive">
          <AlertTitle>Unable to load brackets</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "Unknown error"}
          </AlertDescription>
        </Alert>
        {!kiosk && (
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            Retry
          </Button>
        )}
      </main>
    );
  }

  return (
    <main
      className={
        kiosk
          ? "mx-auto max-w-6xl space-y-10 p-4 text-base md:p-6"
          : "mx-auto max-w-5xl space-y-8 p-6"
      }
    >
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Tournament Brackets</p>
        <h1 className={kiosk ? "text-3xl font-semibold" : "text-2xl font-semibold"}>{data.tournamentName}</h1>
        <p className="text-sm text-muted-foreground">
          Viewing bracket summary for divisions with published brackets and standings.
        </p>
      </header>

      <section className="space-y-3">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={kiosk ? "text-2xl font-semibold" : "text-xl font-semibold"}>Divisions</h2>
          {!kiosk && (
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? "Refreshing…" : "Refresh"}
            </Button>
          )}
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          {data.divisions.map((division) => (
            <Card key={division.divisionId}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base font-semibold leading-snug text-foreground">
                    {division.divisionName}
                  </CardTitle>
                  {division.seedings.length > 0 && (
                    <p className="text-xs text-muted-foreground">Seedings published</p>
                  )}
                </div>
                <Badge variant="outline">{division.brackets.length} brackets</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                {division.seedings.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">Seedings</h3>
                    {division.seedings[0].config?.groups ? (
                      <GroupGrid
                        seedings={division.seedings}
                        groups={division.seedings[0].config.groups}
                        kiosk={kiosk}
                      />
                    ) : (
                      <SeedingsTable seedings={division.seedings} kiosk={kiosk} />
                    )}
                  </div>
                )}

                {division.brackets.map((bracket) => (
                  <div key={bracket.bracketId} className="space-y-2 rounded-md border border-border bg-card/60 p-4">
                    <header className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">{bracket.type.replace(/_/g, " ")}</h4>
                        <p className="text-xs text-muted-foreground">
                          {bracket.config.bestOf ? `Best of ${bracket.config.bestOf}` : "Bracket"}
                        </p>
                      </div>
                      <Badge variant={bracket.locked ? "default" : "outline"}>
                        {bracket.locked ? "Locked" : "Editing"}
                      </Badge>
                    </header>
                    <MatchesTable matches={bracket.matches} kiosk={kiosk} />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
