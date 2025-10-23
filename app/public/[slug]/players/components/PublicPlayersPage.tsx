"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicPlayers } from "@/frontend/hooks/usePublicPlayers";

type Props = {
  slug: string;
};

function TeamCard({
  team,
  kiosk,
}: {
  team: {
    teamId: string;
    teamName: string;
    entryCode: string | null;
    seedNote: string | null;
    players: Array<{ id: string | null; firstName: string | null; lastName: string | null; dateOfBirth: string | null }>;
  };
  kiosk: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base font-semibold leading-snug">{team.teamName}</CardTitle>
          {team.seedNote && <p className="text-xs text-muted-foreground">Seed note: {team.seedNote}</p>}
        </div>
        {team.entryCode && <Badge variant="secondary">{team.entryCode}</Badge>}
      </CardHeader>
      <CardContent>
        <ul className={`space-y-1 ${kiosk ? "text-base" : "text-sm"} text-foreground`}>
          {team.players.length === 0 && <li className="italic text-muted-foreground">No players listed</li>}
          {team.players.map((player, index) => (
            <li key={player.id ?? index}>
              {(player.firstName ?? "").trim()} {(player.lastName ?? "").trim()}
              {player.dateOfBirth && (
                <span className="ml-2 text-xs text-muted-foreground">
                  DOB: {new Date(player.dateOfBirth).toLocaleDateString()}
                </span>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default function PublicPlayersPage({ slug }: Props) {
  const searchParams = useSearchParams();
  const kioskParam = searchParams.get("kiosk");
  const kiosk = kioskParam === "1" || kioskParam?.toLowerCase() === "true";

  const { data, isLoading, isError, error, refetch, isFetching } = usePublicPlayers(slug, {
    refetchInterval: kiosk ? 15_000 : undefined,
  });
  const [query, setQuery] = React.useState("");
  const [normalizedQuery, setNormalizedQuery] = React.useState("");

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setNormalizedQuery(query.trim().toLowerCase());
    }, 200);

    return () => window.clearTimeout(timer);
  }, [query]);

  const filterTeam = React.useCallback(
    (team: {
      teamId: string;
      teamName: string;
      entryCode: string | null;
      seedNote: string | null;
      players: Array<{ id: string | null; firstName: string | null; lastName: string | null; dateOfBirth: string | null }>;
    }) => {
      if (!normalizedQuery) {
        return true;
      }

      const normalizedName = team.teamName.toLowerCase();
      if (normalizedName.includes(normalizedQuery)) {
        return true;
      }

      if (team.entryCode && team.entryCode.toLowerCase().includes(normalizedQuery)) {
        return true;
      }

      return team.players.some((player) => {
        const fullName = `${player.firstName ?? ""} ${player.lastName ?? ""}`.trim().toLowerCase();
        return fullName.includes(normalizedQuery);
      });
    },
    [normalizedQuery],
  );

  if (isLoading) {
    return (
      <main className="mx-auto max-w-5xl space-y-4 p-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-14 w-full" />
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
          <AlertTitle>Unable to load players</AlertTitle>
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

  const filteredTeams = data?.teams?.filter(filterTeam) ?? [];

  return (
    <main
      className={
        kiosk
          ? "mx-auto max-w-6xl space-y-8 p-4 text-base md:p-6"
          : "mx-auto max-w-5xl space-y-6 p-6"
      }
    >
      <header className="space-y-2">
        <h1 className={kiosk ? "text-3xl font-semibold" : "text-2xl font-semibold"}>{data.tournamentName}</h1>
        <p className="text-sm text-muted-foreground">
          View registered teams and rosters. Use search to filter by team, player, or entry code.
        </p>
      </header>

      {!kiosk && (
        <div className="rounded-lg border border-border bg-card/80 p-4">
          <LabelledSearch query={query} setQuery={setQuery} />
        </div>
      )}

      <section className="space-y-3">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={kiosk ? "text-2xl font-semibold" : "text-xl font-semibold"}>Teams</h2>
          <Badge variant="outline">{filteredTeams.length} showing</Badge>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          {filteredTeams.length === 0 && (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">No teams match your search.</CardContent>
            </Card>
          )}
          {filteredTeams.map((team) => (
            <TeamCard key={team.teamId} team={team} kiosk={kiosk} />
          ))}
        </div>
      </section>
    </main>
  );
}

function LabelledSearch({ query, setQuery }: { query: string; setQuery: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <label htmlFor="public-search" className="text-sm font-medium text-foreground">
        Search teams, players, or entry codes
      </label>
      <Input
        id="public-search"
        type="search"
        placeholder="e.g. Johnson, 12U, MP-301"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
    </div>
  );
}
