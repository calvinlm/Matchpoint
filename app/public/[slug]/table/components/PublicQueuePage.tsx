"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicQueue } from "@/frontend/hooks/usePublicQueue";

type Props = {
  slug: string;
};

function QueueMatchRow({
  match,
}: {
  match: {
    id: string;
    team1: { id: string; name: string; entryCode: string | null } | null;
    team2: { id: string; name: string; entryCode: string | null } | null;
    startTime: string | null;
    createdAt: string;
  };
}) {
  const formatTeam = (team: { name: string; entryCode: string | null } | null) => {
    if (!team) {
      return "TBD";
    }
    return team.entryCode ? `${team.entryCode} · ${team.name}` : team.name;
  };

  return (
    <tr>
      <td className="px-3 py-2 text-sm text-foreground">{formatTeam(match.team1)}</td>
      <td className="px-3 py-2 text-sm text-foreground">{formatTeam(match.team2)}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {match.startTime ? new Date(match.startTime).toLocaleTimeString() : "Awaiting assignment"}
      </td>
    </tr>
  );
}

function CourtCard({
  court,
  kiosk,
}: {
  court: {
    id: string;
    label: string;
    active: boolean;
    assignment: {
      id: string;
      divisionName: string;
      bracketType: string;
      team1: { name: string; entryCode: string | null } | null;
      team2: { name: string; entryCode: string | null } | null;
      startTime: string | null;
    } | null;
  };
  kiosk: boolean;
}) {
  const assignment = court.assignment;
  return (
    <Card className={court.active ? "border-primary/40 bg-primary/5" : undefined}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Court {court.label}</CardTitle>
        <Badge variant={court.active ? "secondary" : "outline"}>{court.active ? "Active" : "Inactive"}</Badge>
      </CardHeader>
      <CardContent>
        {assignment ? (
          <div className={`space-y-1 ${kiosk ? "text-sm" : "text-xs"} text-muted-foreground`}>
            <p className="font-medium text-foreground">
              {assignment.team1?.entryCode ? `${assignment.team1.entryCode} · ` : ""}
              {assignment.team1?.name ?? "TBD"}
            </p>
            <p className="font-medium text-foreground">
              {assignment.team2?.entryCode ? `${assignment.team2.entryCode} · ` : ""}
              {assignment.team2?.name ?? "TBD"}
            </p>
            <p className={kiosk ? "text-xs" : "text-[11px]"}>
              {assignment.divisionName} • {assignment.bracketType.replace(/_/g, " ")}
            </p>
            <p className={kiosk ? "text-xs" : "text-[11px]"}>
              Assigned {assignment.startTime ? new Date(assignment.startTime).toLocaleTimeString() : "just now"}
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No match assigned.</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function PublicQueuePage({ slug }: Props) {
  const searchParams = useSearchParams();
  const kioskParam = searchParams.get("kiosk");
  const kiosk = kioskParam === "1" || kioskParam?.toLowerCase() === "true";

  const { data, isLoading, isError, error, refetch, isFetching } = usePublicQueue(slug, {
    refetchInterval: kiosk ? 7_500 : undefined,
  });

  if (isLoading) {
    return (
      <main className="mx-auto max-w-5xl space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="mx-auto max-w-4xl space-y-4 p-6">
        <Alert variant="destructive">
          <AlertTitle>Unable to load queue</AlertTitle>
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
          ? "mx-auto max-w-6xl space-y-10 p-4 text-base md:p-6"
          : "mx-auto max-w-5xl space-y-8 p-6"
      }
    >
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-slate-500">Live Queue</p>
        <h1 className="text-3xl font-bold text-slate-900">{data.tournamentName}</h1>
        <p className="text-sm text-slate-600">Updated {new Date(data.updatedAt).toLocaleTimeString()}</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Courts</h2>
        {data.courts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No courts configured.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {data.courts.map((court) => (
              <CourtCard key={court.id} court={court} kiosk={kiosk} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-6">
        <h2 className="text-lg font-semibold text-slate-900">Queue</h2>
        {data.divisions.length === 0 && <p className="text-sm text-muted-foreground">No divisions available yet.</p>}

        {data.divisions.map((division) => (
          <section key={division.id} className="space-y-4">
            <header>
              <h3 className="text-base font-semibold text-foreground">{division.name}</h3>
            </header>

            {division.brackets.length === 0 ? (
              <p className="text-sm text-slate-500">No brackets configured.</p>
            ) : (
              division.brackets.map((bracket) => (
                <Card key={bracket.id}>
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                      {bracket.type.replace(/_/g, " ")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {bracket.queue.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Queue is empty.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-md border border-border">
                        <table className="min-w-full divide-y divide-border text-sm">
                          <thead className="bg-muted/50">
                            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              <th className="px-3 py-2">Team 1</th>
                              <th className="px-3 py-2">Team 2</th>
                              <th className="px-3 py-2">Start</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border bg-card">
                            {bracket.queue.map((match) => (
                              <QueueMatchRow key={match.id} match={match} />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </section>
        ))}
      </section>
    </main>
  );
}
