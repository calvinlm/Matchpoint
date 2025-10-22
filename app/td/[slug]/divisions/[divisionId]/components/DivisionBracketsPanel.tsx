"use client";

import React, { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBrackets, useUpdateBracket, useDeleteBracket, Bracket } from "@/frontend/hooks/useBrackets";
import { BracketForm } from "./BracketForm";
import { BracketSeedingBoard } from "./BracketSeedingBoard";
import { BracketEditModal } from "./BracketEditModal";
import { CourtAssignmentBoard } from "./CourtAssignmentBoard";
import { BracketStandingsTable } from "./BracketStandingsTable";

type Props = {
  slug: string;
  divisionId: string;
  token?: string;
};

export function DivisionBracketsPanel({ slug, divisionId, token }: Props) {
  const { data, isLoading, isError, error } = useBrackets(slug, token);
  const updateMutation = useUpdateBracket(slug, token);
  const deleteMutation = useDeleteBracket(slug, token);
  const [editing, setEditing] = useState<Bracket | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load brackets</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : "Unknown error"}
        </AlertDescription>
      </Alert>
    );
  }

  const brackets = (data ?? []).filter((bracket) => bracket.divisionId === divisionId);

  return (
    <div className="space-y-6">
      <BracketForm slug={slug} divisionId={divisionId} token={token} />

      {brackets.length === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No brackets configured for this division yet. Create the first bracket above to get started.
          </CardContent>
        </Card>
      )}

      {brackets.map((bracket) => (
        <Card key={bracket.id}>
          <CardHeader className="flex flex-col gap-2 space-y-0 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg capitalize">
                {bracket.type.replace(/_/g, " ").toLowerCase()}
              </CardTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Best of {bracket.config.bestOf}</span>
                <span>•</span>
                <span>{bracket.config.winBy2 ? "Win by 2" : "Win by 1"}</span>
                {bracket.config.groups && (
                  <>
                    <span>•</span>
                    <span>
                      {bracket.config.groups} groups × {bracket.config.groupSize ?? "?"} teams
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={bracket.locked ? "default" : "outline"}>
                {bracket.locked ? "Locked" : "Editing"}
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => setEditing(bracket)}>
                Edit
              </Button>
              <Button
                variant={bracket.locked ? "outline" : "default"}
                size="sm"
                onClick={() =>
                  updateMutation.mutate({
                    bracketId: bracket.id,
                    payload: { locked: !bracket.locked },
                  })
                }
                disabled={updateMutation.isLoading}
              >
                {updateMutation.isLoading ? "Updating…" : bracket.locked ? "Unlock" : "Lock"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (window.confirm("Delete this bracket and all associated matches?")) {
                    deleteMutation.mutate(bracket.id);
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                Delete
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {bracket.config.rounds && (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Rounds</p>
                <div className="space-y-1 rounded-md border border-dashed border-border bg-muted/40 p-3">
                  {bracket.config.rounds.map((round) => (
                    <div key={round.name} className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="font-medium text-foreground">{round.name}</span>
                      <span>{round.matchCount} matches</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!bracket.locked && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-foreground">Seeding</p>
                <BracketSeedingBoard
                  slug={slug}
                  divisionId={divisionId}
                  bracketId={bracket.id}
                  token={token}
                />
              </div>
            )}

            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">Court assignments</p>
              <CourtAssignmentBoard slug={slug} bracketId={bracket.id} config={bracket.config} token={token} />
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">Standings</p>
              <BracketStandingsTable slug={slug} bracketId={bracket.id} token={token} />
            </div>
          </CardContent>
        </Card>
      ))}
      {(updateMutation.isError || deleteMutation.isError) && (
        <Alert variant="destructive">
          <AlertTitle>Bracket error</AlertTitle>
          <AlertDescription>
            {updateMutation.isError && updateMutation.error instanceof Error
              ? updateMutation.error.message
              : deleteMutation.error instanceof Error
                ? deleteMutation.error.message
                : "Unknown error"}
          </AlertDescription>
        </Alert>
      )}

      {editing && (
        <BracketEditModal
          slug={slug}
          bracket={editing}
          token={token}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
