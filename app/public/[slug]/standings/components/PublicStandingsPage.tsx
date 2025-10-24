"use client";

import React, { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicStandings } from "@/frontend/hooks/usePublicStandings";
import { usePublicQueue } from "@/frontend/hooks/usePublicQueue";

// ----------------------
// Types
// ----------------------

type Props = {
  slug: string;
};

type QueueMatch = {
  id: string;
  team1: { id: string; name: string; entryCode: string | null } | null;
  team2: { id: string; name: string; entryCode: string | null } | null;
  startTime: string | null;
  createdAt: string;
};

type Court = {
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

// ----------------------
// Small components lifted from the Queue page (kept self-contained)
// ----------------------

function QueueMatchRow({ match }: { match: QueueMatch }) {
  const formatTeam = (team: { name: string; entryCode: string | null } | null) => {
    if (!team) return "TBD";
    return team.entryCode ? `${team.entryCode} · ${team.name}` : team.name;
  };

  return (
    <tr>
      <td className="px-3 py-1 text-xs text-foreground">{formatTeam(match.team1)}</td>
      <td className="px-3 py-1 text-xs text-foreground">{formatTeam(match.team2)}</td>
      <td className="px-3 py-1 text-[11px] text-muted-foreground">
        {match.startTime ? new Date(match.startTime).toLocaleTimeString() : "Awaiting assignment"}
      </td>
    </tr>
  );
}

function CourtCard({ court, kiosk }: { court: Court; kiosk: boolean }) {
  const assignment = court.assignment;
  return (
    <Card className={`shadow-sm ${court.active ? "border-primary/40 bg-primary/5" : ""}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3">
        <CardTitle className={kiosk ? "text-base" : "text-sm"}>Court {court.label}</CardTitle>
        <Badge variant={court.active ? "secondary" : "outline"}>{court.active ? "Active" : "Inactive"}</Badge>
      </CardHeader>
      <CardContent className="py-3">
        {assignment ? (
          <div className={`space-y-1 ${kiosk ? "text-sm" : "text-xs"} text-muted-foreground`}>
            <div className="font-medium text-foreground">
              {assignment.team1?.entryCode ? `${assignment.team1.entryCode} · ` : ""}
              {assignment.team1?.name ?? "TBD"}
            </div>
            <div className="font-medium text-foreground">
              {assignment.team2?.entryCode ? `${assignment.team2.entryCode} · ` : ""}
              {assignment.team2?.name ?? "TBD"}
            </div>
            <div className={kiosk ? "text-xs" : "text-[11px]"}>
              {assignment.divisionName} • {assignment.bracketType.replace(/_/g, " ")}
            </div>
            <div className={kiosk ? "text-xs" : "text-[11px]"}>
              Assigned {assignment.startTime ? new Date(assignment.startTime).toLocaleTimeString() : "just now"}
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">No match assigned.</div>
        )}
      </CardContent>
    </Card>
  );
}

// ----------------------
// Existing Standing Table (unaltered)
// ----------------------

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

// ----------------------
// Main Page
// ----------------------

export default function PublicStandingsPage({ slug }: Props) {
  const searchParams = useSearchParams();
  const kioskParam = searchParams.get("kiosk");
  const kiosk = kioskParam === "1" || kioskParam?.toLowerCase() === "true";

  // Standings data (existing)
  const { data, isLoading, isError, error, refetch, isFetching } = usePublicStandings(slug, {
    refetchInterval: kiosk ? 15_000 : undefined,
  });

  // Queue data (new) — keep hooks unconditional to avoid hook order issues
  const {
    data: queueData,
    isLoading: isQueueLoading,
    isError: isQueueError,
    error: queueError,
    refetch: refetchQueue,
    isFetching: isQueueFetching,
  } = usePublicQueue(slug, {
    refetchInterval: kiosk ? 7_500 : undefined,
  });

  // Division filter (existing)
  const [selectedDivisionId, setSelectedDivisionId] = useState<string | null>(null);

  const filteredDivisions = useMemo(() => {
    if (!data) return [];
    if (selectedDivisionId === null) return data.divisions;
    return data.divisions.filter((d) => d.id === selectedDivisionId);
  }, [data, selectedDivisionId]);

  // Helper classes for kiosk mode
  const baseClasses = kiosk ? "p-4 text-base md:p-6" : "p-6 text-sm";
  const headerClasses = kiosk ? "text-3xl font-semibold" : "text-2xl font-semibold";
  const subheaderClasses = kiosk ? "text-2xl font-semibold" : "text-xl font-semibold";

  return (
    <div className={`flex min-h-screen ${kiosk ? "text-base" : ""}`}>
      {/* LEFT: Live Queue sidebar */}
      <aside className="w-72 flex-shrink-0 border-r border-border bg-muted/40 p-4 lg:w-80">
        <div className="space-y-4">
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Live Queue</div>
            <h2 className={subheaderClasses}>{queueData?.tournamentName ?? "Queue"}</h2>
            {queueData && (
              <div className="text-xs text-muted-foreground">Updated {new Date(queueData.updatedAt).toLocaleTimeString()}</div>
            )}
          </div>

          {/* Courts */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className={kiosk ? "text-lg font-semibold" : "text-sm font-semibold"}>Courts</h3>
              {queueData && <Badge variant="outline">{queueData.courts.length}</Badge>}
            </div>

            {isQueueLoading ? (
              <div className="grid gap-2">
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </div>
            ) : isQueueError ? (
              <div className="space-y-2">
                <Alert variant="destructive">
                  <AlertTitle>Unable to load queue</AlertTitle>
                  <AlertDescription>
                    {queueError instanceof Error ? queueError.message : "Unknown error"}
                  </AlertDescription>
                </Alert>
                {!kiosk && (
                  <Button variant="outline" size="sm" onClick={() => refetchQueue()} disabled={isQueueFetching}>
                    Retry
                  </Button>
                )}
              </div>
            ) : queueData && queueData.courts.length > 0 ? (
              <div className="grid gap-2">
                {queueData.courts.map((court: Court) => (
                  <CourtCard key={court.id} court={court} kiosk={kiosk} />)
                )}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">No courts configured.</div>
            )}
          </section>

          {/* Compact Queue List */}
          <section className="space-y-2">
            <h3 className={kiosk ? "text-lg font-semibold" : "text-sm font-semibold"}>Queue</h3>
            {isQueueLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-6" />
                <Skeleton className="h-24" />
              </div>
            ) : queueData && queueData.divisions.length > 0 ? (
              <div className="space-y-3">
                {queueData.divisions.map((division: any) => (
                  <div key={division.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className={kiosk ? "text-sm font-semibold" : "text-xs font-semibold"}>{division.name}</div>
                      <Badge variant="secondary" className="ml-2">
                        {division.brackets.reduce((n: number, b: any) => n + b.queue.length, 0)}
                      </Badge>
                    </div>

                    {division.brackets.map((bracket: any) => (
                      <Card key={bracket.id}>
                        <CardHeader className="py-2">
                          <CardTitle className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {bracket.type.replace(/_/g, " ")}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="py-2">
                          {bracket.queue.length === 0 ? (
                            <div className="text-xs text-muted-foreground">Queue is empty.</div>
                          ) : (
                            <div className="overflow-x-auto rounded-md border border-border">
                              <table className="min-w-full divide-y divide-border text-xs">
                                <thead className="bg-muted/50">
                                  <tr className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    <th className="px-3 py-1">Team 1</th>
                                    <th className="px-3 py-1">Team 2</th>
                                    <th className="px-3 py-1">Start</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border bg-card">
                                  {bracket.queue.slice(0, kiosk ? 6 : 3).map((match: QueueMatch) => (
                                    <QueueMatchRow key={match.id} match={match} />
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">No divisions available yet.</div>
            )}
          </section>
        </div>
      </aside>

      {/* RIGHT: Standings main content */}
      <main className={`flex-1 space-y-6 ${baseClasses}`}>
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <div className="grid gap-3 md:grid-cols-2">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          </div>
        )}

        {isError && (
          <div className="max-w-4xl space-y-4">
            <Alert variant="destructive">
              <AlertTitle>Unable to load standings</AlertTitle>
              <AlertDescription>{error instanceof Error ? error.message : "Unknown error"}</AlertDescription>
            </Alert>
            {!kiosk && (
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                Retry
              </Button>
            )}
          </div>
        )}

        {data && (
          <>
            <header className="space-y-1">
              <h1 className={headerClasses}>{data.tournamentName}</h1>
              <div className="text-sm text-muted-foreground">
                Live standings update automatically as matches are scored. Quotient ties use decimal precision.
              </div>
            </header>

            <section className="space-y-4">
              <header className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className={subheaderClasses}>Divisions</h2>
                  <Badge variant="outline">{data.divisions.length} total</Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size={kiosk ? "default" : "sm"}
                    variant={selectedDivisionId === null ? "default" : "outline"}
                    onClick={() => setSelectedDivisionId(null)}
                  >
                    All Divisions
                  </Button>
                  {data.divisions.map((division) => (
                    <Button
                      key={division.id}
                      size={kiosk ? "default" : "sm"}
                      variant={selectedDivisionId === division.id ? "default" : "outline"}
                      onClick={() => setSelectedDivisionId(division.id)}
                    >
                      {division.name}
                    </Button>
                  ))}
                </div>
              </header>

              <div className="space-y-4">
                {filteredDivisions.length === 0 && selectedDivisionId !== null && (
                  <div className="text-muted-foreground">No divisions match the selected filter.</div>
                )}

                {filteredDivisions.map((division) => (
                  <Card key={division.id}>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0">
                      <div>
                        <CardTitle className="text-base font-semibold leading-snug text-foreground">
                          {division.name}
                        </CardTitle>
                        <div className="text-xs text-muted-foreground">{division.brackets.length} brackets</div>
                      </div>
                      <Badge variant="outline">
                        {division.brackets.reduce((count, bracket) => count + bracket.standings.length, 0)} teams
                      </Badge>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {division.brackets.map((bracket) => (
                        <div key={bracket.id} className="space-y-2">
                          <header className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold text-foreground">
                              {bracket.type.replace(/_/g, " ")}
                            </h3>
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
          </>
        )}
      </main>
    </div>
  );
}
