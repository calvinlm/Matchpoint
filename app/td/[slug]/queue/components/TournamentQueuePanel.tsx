"use client";

import React from "react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useTournamentQueue,
  TournamentQueue,
  MatchSummary,
} from "@/frontend/hooks/useBrackets";

type Props = {
  slug: string;
  token?: string;
};

function formatTeam(team: MatchSummary["team1"]) {
  if (!team) {
    return "TBD";
  }

  if (!team.players || team.players.length === 0) {
    const base = team.entryCode ? `${team.entryCode} · ${team.name}` : team.name;
    return base;
  }

  const players = team.players
    .map((player) => {
      if (!player) {
        return null;
      }

      const name = [player.firstName, player.lastName].filter(Boolean).join(" ");
      return name || null;
    })
    .filter((value): value is string => Boolean(value));

  return players.length > 0 ? `${base} (${players.join(", ")})` : base;
}

function ConflictSummary({ match }: { match: MatchSummary }) {
  if (!match.conflicts || match.conflicts.length === 0) {
    return null;
  }

  return (
    <ul className="mt-1 space-y-1 text-xs text-destructive">
      {match.conflicts.map((conflict) => {
        const opponentNames = conflict.opponents
          ?.map((team) => team?.name)
          .filter((value): value is string => Boolean(value))
          .join(", ");

        const sharedPlayers = conflict.sharedPlayers
          ?.map((player) => [player?.firstName, player?.lastName].filter(Boolean).join(" "))
          .filter((name) => name && name.trim().length > 0)
          .join(", ");

        return (
          <li key={`${match.id}-${conflict.matchId}-${conflict.type}`}>
            Conflict with {opponentNames ?? "another match"}
            {conflict.type === "PLAYER" && sharedPlayers
              ? ` — shared player${conflict.sharedPlayers.length > 1 ? "s" : ""}: ${sharedPlayers}`
              : " (team overlap)"}
          </li>
        );
      })}
    </ul>
  );
}

function QueueTable({ queue }: { queue: Array<MatchSummary & { divisionName?: string; bracketType?: string }> }) {
  if (queue.length === 0) {
    return <p className="text-sm text-muted-foreground">No matches waiting in the queue.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-muted/50">
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2">Bracket</th>
            <th className="px-3 py-2">Match</th>
            <th className="px-3 py-2">Priority</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Conflicts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {queue.map((match) => (
            <tr key={match.id} className="align-top">
              <td className="px-3 py-3">
                <div className="font-medium text-foreground">
                  {match.divisionName ?? match.divisionId}
                </div>
                <div className="text-xs text-muted-foreground">
                  {match.bracketType ? match.bracketType.replace(/_/g, " ") : "Bracket"}
                </div>
              </td>
              <td className="px-3 py-3">
                <div>{formatTeam(match.team1)}</div>
                <div className="text-xs text-muted-foreground">vs</div>
                <div>{formatTeam(match.team2)}</div>
              </td>
              <td className="px-3 py-3 text-muted-foreground">{match.priority ?? 0}</td>
              <td className="px-3 py-3">
                <Badge variant={match.status === "ACTIVE" ? "default" : match.status === "RETIRED" ? "outline" : "secondary"}>
                  {match.status.toLowerCase()}
                </Badge>
              </td>
              <td className="px-3 py-3">
                <ConflictSummary match={match} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BracketQueueCard({
  entry,
  showDivision = true,
}: {
  entry: TournamentQueue["queues"][number];
  showDivision?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          {showDivision && (
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {entry.divisionName}
            </p>
          )}
          <CardTitle className="text-base font-semibold leading-snug">
            {entry.bracketType.replace(/_/g, " ")}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {entry.queue.length} match{entry.queue.length === 1 ? "" : "es"} waiting
          </p>
        </div>
        <Badge variant={entry.queuePaused ? "destructive" : "secondary"}>
          {entry.queuePaused ? "Queue paused" : "Active"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {entry.queue.length === 0 ? (
          <p className="text-sm text-muted-foreground">No queued matches for this bracket.</p>
        ) : (
          entry.queue.map((match) => (
            <div key={match.id} className="rounded-md border border-dashed border-border p-3 text-sm">
              <div className="font-medium text-foreground">{formatTeam(match.team1)}</div>
              <div className="text-xs text-muted-foreground">vs</div>
              <div className="font-medium text-foreground">{formatTeam(match.team2)}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Priority {match.priority ?? 0}</span>
                {match.startTime && (
                  <span>
                    Starts {new Date(match.startTime).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
                <Badge variant="outline">{match.status.toLowerCase()}</Badge>
              </div>
              <ConflictSummary match={match} />
            </div>
          ))
        )}
      </CardContent>
    </Card>

  );
}

export function TournamentQueuePanel({ slug, token }: Props) {
  // Always call hooks at the top
  const { data, isLoading, isError, error, refetch, isFetching } =
    useTournamentQueue(slug, token);

  // Guard inside, not around, hooks
  const queues = data?.queues ?? [];
  const globalQueue = data?.globalQueue ?? [];
  const updatedAt = data?.updatedAt ?? Date.now();
  const tournamentName = data?.tournamentName ?? "Live Queue";

  const divisionGroups = React.useMemo(() => {
    const order: Array<{ divisionId: string; divisionName: string }> = [];
    const buckets = new Map<string, Array<TournamentQueue["queues"][number]>>();

    queues.forEach((entry) => {
      if (!buckets.has(entry.divisionId)) {
        buckets.set(entry.divisionId, []);
        order.push({ divisionId: entry.divisionId, divisionName: entry.divisionName });
      }
      buckets.get(entry.divisionId)!.push(entry);
    });

    return order.map(({ divisionId, divisionName }) => {
      const items = buckets.get(divisionId) ?? [];
      const queuedMatches = items.reduce((count, bracket) => count + bracket.queue.length, 0);
      return { divisionId, divisionName, items, queuedMatches };
    });
  }, [queues]);

  const totalQueued = globalQueue.length;
  const totalBrackets = queues.length;
  const pausedQueues = queues.filter((entry) => entry.queuePaused).length;
  const nextMatch = globalQueue[0];

  // Single return — branch in JSX only
  return (
    <section className="space-y-10">
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : isError ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load queue</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "Unknown error"}
          </AlertDescription>
        </Alert>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">
          No queue data available for this tournament.
        </p>
      ) : (
        <>
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {tournamentName}
              </h1>
              <p className="text-sm text-muted-foreground">Tournament slug: {slug}</p>
              <p className="text-xs text-muted-foreground">
                Updated{" "}
                {new Date(updatedAt).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/td/${slug}`}>Overview</Link>
              </Button>
              <Button onClick={() => refetch()} disabled={isFetching}>
                {isFetching ? "Refreshing…" : "Refresh now"}
              </Button>
            </div>
          </header>

          <section className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="space-y-1 p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Queued Matches
                </p>
                <p className="text-3xl font-semibold text-foreground">
                  {totalQueued}
                </p>
                <p className="text-xs text-muted-foreground">
                  Across {totalBrackets} bracket{totalBrackets === 1 ? "" : "s"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1 p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Paused Queues
                </p>
                <p className="text-3xl font-semibold text-foreground">
                  {pausedQueues}
                </p>
                <p className="text-xs text-muted-foreground">
                  {pausedQueues === 0
                    ? "All queues active"
                    : "Resume paused queues as ready"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-2 p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Next up
                </p>
                {nextMatch ? (
                  <>
                    <p className="text-sm font-semibold text-foreground">
                      {formatTeam(nextMatch.team1)} vs {formatTeam(nextMatch.team2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Priority {nextMatch.priority ?? 0} •{" "}
                      {nextMatch.bracketType?.replace(/_/g, " ")}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Queue is clear — waiting for new matches.
                  </p>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Global queue</h2>
              <Badge variant="outline">{totalQueued} waiting</Badge>
            </div>
            <QueueTable queue={globalQueue} />
          </section>

          <section className="space-y-5">
            <h2 className="text-lg font-semibold">Queues by division</h2>
            {divisionGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No brackets configured yet.
              </p>
            ) : (
              divisionGroups.map((group) => (
                <section
                  key={group.divisionId}
                  id={`division-${group.divisionId}`}
                  className="space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-semibold text-foreground">
                      {group.divisionName}
                    </h3>
                    <Badge variant="outline">
                      {group.queuedMatches} queued • {group.items.length} bracket
                      {group.items.length === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {group.items.map((entry) => (
                      <BracketQueueCard
                        key={entry.bracketId}
                        entry={entry}
                        showDivision={false}
                      />
                    ))}
                  </div>
                </section>
              ))
            )}
          </section>
        </>
      )}
    </section>
  );
}
