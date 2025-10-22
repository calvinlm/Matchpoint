"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicStandings } from "@/frontend/hooks/usePublicStandings";

type Props = {
  slug: string;
};

function StandingTable({
  bracket,
  kiosk,
}: {
  bracket: {
    id: string;
    type: string;
    standings: Array<{
      teamId: string;
      teamName: string;
      entryCode: string | null;
      wins: number;
      losses: number;
      pointsFor: number;
      pointsAgainst: number;
      quotient: number;
      rank: number;
    }>;
  };
  kiosk: boolean;
}) {
  if (bracket.standings.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className={`min-w-full divide-y divide-border ${kiosk ? "text-base" : "text-sm"}`}>
        <thead className="bg-muted/60">
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2">Rank</th>
            <th className="px-3 py-2">Team</th>
            <th className="px-3 py-2 text-right">W</th>
            <th className="px-3 py-2 text-right">L</th>
            <th className="px-3 py-2 text-right">PF</th>
            <th className="px-3 py-2 text-right">PA</th>
            <th className="px-3 py-2 text-right">Quotient</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {bracket.standings.map((row) => (
            <tr key={row.teamId}>
              <td className="px-3 py-2 font-medium text-foreground">{row.rank}</td>
              <td className="px-3 py-2 text-foreground">
                {row.entryCode ? `${row.entryCode} · ${row.teamName}` : row.teamName}
              </td>
              <td className="px-3 py-2 text-right text-muted-foreground">{row.wins}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{row.losses}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{row.pointsFor}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{row.pointsAgainst}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{row.quotient.toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PublicStandingsPage({ slug }: Props) {
  const searchParams = useSearchParams();
  const kioskParam = searchParams.get("kiosk");
  const kiosk = kioskParam === "1" || kioskParam?.toLowerCase() === "true";

  const { data, isLoading, isError, error, refetch, isFetching } = usePublicStandings(slug, {
    refetchInterval: kiosk ? 15_000 : undefined,
  });

  if (isLoading) {
    return (
      <main className="mx-auto max-w-5xl space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
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
          <AlertTitle>Unable to load standings</AlertTitle>
          <AlertDescription>{error instanceof Error ? error.message : "Unknown error"}</AlertDescription>
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
          ? "mx-auto max-w-6xl space-y-8 p-4 text-base md:p-6"
          : "mx-auto max-w-5xl space-y-6 p-6"
      }
    >
      <header className="space-y-1">
        <h1 className={kiosk ? "text-3xl font-semibold" : "text-2xl font-semibold"}>{data.tournamentName}</h1>
        <p className="text-sm text-muted-foreground">
          Live standings update automatically as matches are scored. Quotient ties use decimal precision.
        </p>
      </header>

      <section className="space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={kiosk ? "text-2xl font-semibold" : "text-xl font-semibold"}>Divisions</h2>
          <Badge variant="outline">{data.divisions.length} total</Badge>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          {data.divisions.map((division) => (
            <Card key={division.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base font-semibold leading-snug text-foreground">
                    {division.name}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{division.brackets.length} brackets</p>
                </div>
                <Badge variant="outline">
                  {division.brackets.reduce((count, bracket) => count + bracket.standings.length, 0)} teams
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                {division.brackets.map((bracket) => (
                  <div key={bracket.id} className="space-y-2">
                    <header className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{bracket.type.replace(/_/g, " ")}</h3>
                      <Badge variant="secondary">{bracket.standings.length} teams</Badge>
                    </header>
                    <StandingTable bracket={bracket} kiosk={kiosk} />
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
