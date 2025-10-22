"use client";

import React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDivisionDetail } from "@/frontend/hooks/useTournamentAdmin";
import { DivisionBracketsPanel } from "./DivisionBracketsPanel";

export default function DivisionWorkspace({
  slug,
  divisionId,
}: {
  slug: string;
  divisionId: string;
}) {
  const divisionQuery = useDivisionDetail(slug, divisionId);

  if (divisionQuery.isLoading) {
    return (
      <main className="space-y-6">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-80 w-full" />
      </main>
    );
  }

  if (divisionQuery.isError || !divisionQuery.data) {
    return (
      <main className="space-y-4">
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            Failed to load division: {divisionQuery.error instanceof Error ? divisionQuery.error.message : "Unknown error"}
          </CardContent>
        </Card>
        <Button asChild variant="outline" size="sm">
          <Link href={`/td/${slug}/divisions`}>Back to divisions</Link>
        </Button>
      </main>
    );
  }

  const division = divisionQuery.data;

  return (
    <main className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{division.name}</h1>
          <Badge variant="outline">Level {division.level}</Badge>
          <Badge variant="outline">Age {division.ageGroup}</Badge>
          <Badge variant="outline">{division.format}</Badge>
          <Badge variant="secondary">{division.teamCount} team{division.teamCount === 1 ? "" : "s"}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Configure brackets, manage seeding, assign courts, and track standings for this division.
        </p>
      </header>

      <DivisionBracketsPanel slug={slug} divisionId={divisionId} />
    </main>
  );
}
