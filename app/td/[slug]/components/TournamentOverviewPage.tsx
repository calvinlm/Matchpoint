"use client";

import React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTournamentSummary } from "@/frontend/hooks/useTournamentSummary";

type Props = {
  slug: string;
};

function StatCard({ label, value, description }: { label: string; value: React.ReactNode; description?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  );
}

export default function TournamentOverviewPage({ slug }: Props) {
  const { data, isError, isLoading, error, refetch, isFetching } = useTournamentSummary(slug);

  if (isLoading) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center p-6 text-sm text-muted-foreground">
        Loading tournament summary…
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-destructive">
          Failed to load tournament: {error instanceof Error ? error.message : "Unknown error"}
        </p>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? "Retrying…" : "Retry"}
        </Button>
      </main>
    );
  }

  const {
    name,
    location,
    startDate,
    endDate,
    totalDivisions,
    totalBrackets,
    totalCourts,
    activeCourts,
    activeMatches,
    queuedMatches,
    divisions,
    courts,
  } = data;

  return (
    <main className="space-y-8 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">{name}</h1>
            <Badge variant="secondary">Slug: {slug}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {location ? `${location} • ` : ""}
            {startDate ? new Date(startDate).toLocaleDateString() : "TBD"}
            {endDate ? ` – ${new Date(endDate).toLocaleDateString()}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href={`/td/${slug}/queue`}>View live queue</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Divisions" value={totalDivisions} />
        <StatCard label="Brackets" value={totalBrackets} />
        <StatCard label="Courts" value={`${activeCourts} / ${totalCourts}`} description="Active / total" />
        <StatCard label="Matches" value={activeMatches} description={`${queuedMatches} waiting in queue`} />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Divisions</h2>
          <Badge variant="outline">{divisions.length} total</Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {divisions.map((division) => (
            <Card key={division.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base font-semibold leading-snug">{division.name}</CardTitle>
                  <CardDescription>
                    {division.bracketCount} brackets • {division.pendingMatches} matches pending
                  </CardDescription>
                </div>
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/td/${slug}/divisions/${division.id}`}>Open</Link>
                </Button>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {division.brackets.map((bracket) => (
                    <li
                      key={bracket.id}
                      className="flex items-center justify-between rounded-md border border-dashed border-border px-3 py-2"
                    >
                      <span className="font-medium text-foreground">{bracket.type.replace(/_/g, " ")}</span>
                      <span className="flex items-center gap-1 text-xs">
                        {bracket.pendingMatches} pending •
                        <Badge variant={bracket.locked ? "default" : "outline"}>
                          {bracket.locked ? "Locked" : "Editing"}
                        </Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Courts</h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {courts.map((court) => (
            <Card key={court.id} className={court.active ? "border-emerald-400/50 bg-emerald-50" : undefined}>
              <CardContent className="flex flex-col gap-1 p-3">
                <span className="font-medium text-foreground">Court {court.label}</span>
                <span className="text-xs text-muted-foreground">{court.active ? "Active" : "Inactive"}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
