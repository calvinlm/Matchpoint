"use client";

import React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useTournamentDivisions,
  useCreateDivision,
  useUpdateDivision,
  useDeleteDivision,
} from "@/frontend/hooks/useTournamentAdmin";
import type { DivisionListItem } from "@/frontend/api/tournaments";

const LEVEL_PLACEHOLDER = "NOV / INT / ADV / OPN";
const AGE_GROUP_PLACEHOLDER = "JUNIOR / A18 / A35 / A50";

function DivisionCreateForm({ slug }: { slug: string }) {
  const [form, setForm] = React.useState({
    name: "",
    level: "",
    ageGroup: "",
    format: "DOUBLES",
  });
  const createDivision = useCreateDivision(slug);

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.level.trim() || !form.ageGroup.trim() || !form.format.trim()) {
      return;
    }

    createDivision.mutate(
      {
        name: form.name.trim(),
        level: form.level.trim().toUpperCase(),
        ageGroup: form.ageGroup.trim().toUpperCase(),
        format: form.format.trim().toUpperCase(),
      },
      {
        onSuccess: () => {
          setForm({ name: "", level: "", ageGroup: "", format: "DOUBLES" });
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create division</CardTitle>
        <CardDescription>Provide level and age group codes as defined in the PRD.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="division-name">Name</Label>
            <Input
              id="division-name"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Men's Doubles"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="division-level">Level</Label>
            <Input
              id="division-level"
              value={form.level}
              onChange={(event) => setForm((prev) => ({ ...prev, level: event.target.value }))}
              placeholder={LEVEL_PLACEHOLDER}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="division-age">Age group</Label>
            <Input
              id="division-age"
              value={form.ageGroup}
              onChange={(event) => setForm((prev) => ({ ...prev, ageGroup: event.target.value }))}
              placeholder={AGE_GROUP_PLACEHOLDER}
              required
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="division-format">Format</Label>
            <Input
              id="division-format"
              value={form.format}
              onChange={(event) => setForm((prev) => ({ ...prev, format: event.target.value }))}
              placeholder="DOUBLES"
              required
            />
          </div>
          {createDivision.error && (
            <p className="md:col-span-2 text-sm text-destructive">{createDivision.error.message}</p>
          )}
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" disabled={createDivision.isPending}>
              {createDivision.isPending ? "Creating…" : "Create division"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function DivisionCard({ slug, division }: { slug: string; division: DivisionListItem }) {
  const deleteDivision = useDeleteDivision(slug);
  const updateDivision = useUpdateDivision(slug, division.id);
  const [isEditing, setIsEditing] = React.useState(false);
  const [form, setForm] = React.useState({
    name: division.name,
    level: division.level,
    ageGroup: division.ageGroup,
    format: division.format,
  });

  const handleDelete = () => {
    if (!window.confirm(`Delete division "${division.name}"? All brackets and matches will be removed.`)) {
      return;
    }
    deleteDivision.mutate(division.id);
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    updateDivision.mutate(
      {
        name: form.name.trim(),
        level: form.level.trim().toUpperCase(),
        ageGroup: form.ageGroup.trim().toUpperCase(),
        format: form.format.trim().toUpperCase(),
      },
      {
        onSuccess: () => setIsEditing(false),
      },
    );
  };

  return (
    <Card key={division.id} className="flex flex-col justify-between">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold leading-tight">{division.name}</CardTitle>
            <CardDescription>
              Level {division.level} • Age {division.ageGroup} • Format {division.format}
            </CardDescription>
          </div>
          <Badge variant="outline">{division.bracketCount} bracket{division.bracketCount === 1 ? "" : "s"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{division.teamCount} registered teams</p>
        {isEditing ? (
          <form className="grid gap-3" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <Label htmlFor={`edit-name-${division.id}`}>Name</Label>
              <Input
                id={`edit-name-${division.id}`}
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor={`edit-level-${division.id}`}>Level</Label>
                <Input
                  id={`edit-level-${division.id}`}
                  value={form.level}
                  onChange={(event) => setForm((prev) => ({ ...prev, level: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`edit-age-${division.id}`}>Age group</Label>
                <Input
                  id={`edit-age-${division.id}`}
                  value={form.ageGroup}
                  onChange={(event) => setForm((prev) => ({ ...prev, ageGroup: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`edit-format-${division.id}`}>Format</Label>
                <Input
                  id={`edit-format-${division.id}`}
                  value={form.format}
                  onChange={(event) => setForm((prev) => ({ ...prev, format: event.target.value }))}
                  required
                />
              </div>
            </div>
            {updateDivision.error && (
              <p className="text-sm text-destructive">{updateDivision.error.message}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateDivision.isPending}>
                {updateDivision.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href={`/td/${slug}/divisions/${division.id}`}>Open workspace</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/td/${slug}/queue#division-${division.id}`}>View queue</Link>
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setIsEditing((prev) => !prev)}>
            {isEditing ? "Close edit" : "Edit"}
          </Button>
          <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleteDivision.isPending}>
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DivisionsDirectory({ slug }: { slug: string }) {
  const divisionsQuery = useTournamentDivisions(slug);

  if (divisionsQuery.isLoading) {
    return (
      <main className="space-y-6">
        <Skeleton className="h-10 w-56" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </main>
    );
  }

  if (divisionsQuery.isError) {
    return (
      <main className="space-y-4">
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            Failed to load divisions: {divisionsQuery.error instanceof Error ? divisionsQuery.error.message : "Unknown error"}
          </CardContent>
        </Card>
      </main>
    );
  }

  const divisions = divisionsQuery.data?.divisions ?? [];

  return (
    <main className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Divisions</h1>
        <p className="text-sm text-muted-foreground">
          Configure brackets, manage team registrations, and monitor queues per division.
        </p>
      </header>

      <DivisionCreateForm slug={slug} />

      <section className="grid gap-4 md:grid-cols-2">
        {divisions.length === 0 ? (
          <Card className="md:col-span-2">
            <CardContent className="p-6 text-sm text-muted-foreground">
              No divisions yet. Create one above to get started.
            </CardContent>
          </Card>
        ) : (
          divisions.map((division) => <DivisionCard key={division.id} slug={slug} division={division} />)
        )}
      </section>
    </main>
  );
}
