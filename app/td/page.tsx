"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useTournamentList,
  useCreateTournament,
  useUpdateTournament,
  useDeleteTournament,
} from "@/frontend/hooks/useTournamentAdmin";
import type { TournamentListItem } from "@/frontend/api/tournaments";
import { useAuth } from "@/frontend/auth/AuthContext";

function TournamentCreateForm() {
  const [form, setForm] = React.useState({
    name: "",
    slug: "",
    location: "",
    plannedCourtCount: "",
    startDate: "",
    endDate: "",
  });
  const createMutation = useCreateTournament();

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.slug.trim()) {
      return;
    }

    createMutation.mutate({
      name: form.name.trim(),
      slug: form.slug.trim(),
      location: form.location.trim() || null,
      plannedCourtCount: form.plannedCourtCount ? Number(form.plannedCourtCount) : null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
    }, {
      onSuccess: () => {
        setForm({ name: "", slug: "", location: "", plannedCourtCount: "", startDate: "", endDate: "" });
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a tournament</CardTitle>
        <CardDescription>Generate courts automatically by providing a planned court count.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="tournament-name">Name</Label>
            <Input
              id="tournament-name"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Spring Invitational"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tournament-slug">Slug</Label>
            <Input
              id="tournament-slug"
              value={form.slug}
              onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
              placeholder="spring-invitational-2025"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tournament-location">Location</Label>
            <Input
              id="tournament-location"
              value={form.location}
              onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
              placeholder="City, Facility"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="planned-courts">Planned courts</Label>
            <Input
              id="planned-courts"
              type="number"
              min={0}
              value={form.plannedCourtCount}
              onChange={(event) => setForm((prev) => ({ ...prev, plannedCourtCount: event.target.value }))}
              placeholder="6"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="start-date">Start date</Label>
            <Input
              id="start-date"
              type="date"
              value={form.startDate}
              onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end-date">End date</Label>
            <Input
              id="end-date"
              type="date"
              value={form.endDate}
              onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))}
            />
          </div>
          {createMutation.error && (
            <p className="md:col-span-2 text-sm text-destructive">{createMutation.error.message}</p>
          )}
          <div className="md:col-span-2 flex items-center justify-end gap-3">
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create tournament"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function TournamentCard({ tournament }: { tournament: TournamentListItem }) {
  const router = useRouter();
  const deleteMutation = useDeleteTournament();
  const updateMutation = useUpdateTournament(tournament.slug);
  const [isEditing, setIsEditing] = React.useState(false);
  const [form, setForm] = React.useState({
    name: tournament.name,
    slug: tournament.slug,
    location: tournament.location ?? "",
    plannedCourtCount: tournament.plannedCourtCount?.toString() ?? "",
    startDate: tournament.startDate ? tournament.startDate.slice(0, 10) : "",
    endDate: tournament.endDate ? tournament.endDate.slice(0, 10) : "",
  });

  const handleUpdate: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    updateMutation.mutate(
      {
        name: form.name.trim(),
        slug: form.slug.trim() || tournament.slug,
        location: form.location.trim() || null,
        plannedCourtCount: form.plannedCourtCount ? Number(form.plannedCourtCount) : null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
      },
      {
        onSuccess: () => {
          if (form.slug !== tournament.slug) {
            router.refresh();
          }
          setIsEditing(false);
        },
      },
    );
  };

  const handleDelete = () => {
    if (!window.confirm(`Delete tournament "${tournament.name}"? This cannot be undone.`)) {
      return;
    }
    deleteMutation.mutate(tournament.slug);
  };

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>{tournament.name}</CardTitle>
            <Badge variant="secondary">{tournament.slug}</Badge>
          </div>
          <CardDescription className="space-y-1">
            <p>
              {tournament.location ?? "Location TBD"}
              {tournament.startDate && (
                <>
                  {" "}• Starts {new Date(tournament.startDate).toLocaleDateString()}
                </>
              )}
              {tournament.endDate && (
                <>
                  {" "}– Ends {new Date(tournament.endDate).toLocaleDateString()}
                </>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {tournament.divisionCount} division{tournament.divisionCount === 1 ? "" : "s"} • {tournament.courtCount} court
              {tournament.courtCount === 1 ? "" : "s"}
            </p>
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => router.push(`/td/${tournament.slug}`)}>
            Open overview
          </Button>
          <Button size="sm" variant="outline" onClick={() => router.push(`/td/${tournament.slug}/queue`)}>
            Live queue
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setIsEditing((prev) => !prev)}>
            {isEditing ? "Cancel" : "Edit"}
          </Button>
          <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
            Delete
          </Button>
        </div>
      </CardHeader>
      {isEditing ? (
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleUpdate}>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor={`name-${tournament.id}`}>Name</Label>
              <Input
                id={`name-${tournament.id}`}
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`slug-${tournament.id}`}>Slug</Label>
              <Input
                id={`slug-${tournament.id}`}
                value={form.slug}
                onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`location-${tournament.id}`}>Location</Label>
              <Input
                id={`location-${tournament.id}`}
                value={form.location}
                onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`courts-${tournament.id}`}>Planned courts</Label>
              <Input
                id={`courts-${tournament.id}`}
                type="number"
                min={0}
                value={form.plannedCourtCount}
                onChange={(event) => setForm((prev) => ({ ...prev, plannedCourtCount: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`start-${tournament.id}`}>Start date</Label>
              <Input
                id={`start-${tournament.id}`}
                type="date"
                value={form.startDate}
                onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`end-${tournament.id}`}>End date</Label>
              <Input
                id={`end-${tournament.id}`}
                type="date"
                value={form.endDate}
                onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))}
              />
            </div>
            {updateMutation.error && (
              <p className="md:col-span-2 text-sm text-destructive">{updateMutation.error.message}</p>
            )}
            <div className="md:col-span-2 flex items-center justify-end gap-3">
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      ) : null}
    </Card>
  );
}

export default function TdHomePage() {
  const router = useRouter();
  const { logout } = useAuth();
  const tournamentsQuery = useTournamentList();
  const [quickSlug, setQuickSlug] = React.useState("");

  const tournaments = tournamentsQuery.data?.tournaments ?? [];
  const loadError = tournamentsQuery.isError ? tournamentsQuery.error : null;

  const handleQuickNavigate: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    if (!quickSlug.trim()) {
      return;
    }
    router.push(`/td/${quickSlug.trim()}`);
  };

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Tournament Director Console</h1>
          <p className="text-sm text-muted-foreground">
            Manage tournaments, configure divisions, and jump into live operations.
          </p>
        </div>
        <Button variant="outline" onClick={handleLogout} size="sm">
          Sign out
        </Button>
      </header>

      <section className="grid gap-6 lg:grid-cols-[2fr,3fr]">
        <TournamentCreateForm />
        <Card>
          <CardHeader>
            <CardTitle>Quick launch</CardTitle>
            <CardDescription>Open a tournament by slug without editing its settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4 sm:flex-row" onSubmit={handleQuickNavigate}>
              <div className="flex-1 space-y-2">
                <Label htmlFor="quick-slug">Tournament slug</Label>
                <Input
                  id="quick-slug"
                  value={quickSlug}
                  onChange={(event) => setQuickSlug(event.target.value)}
                  placeholder="e.g. fall-classic"
                />
              </div>
              <div className="flex items-end">
                <Button type="submit">Open</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </section>

      <Separator />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Your tournaments</h2>
          <Badge variant="outline">{tournaments.length}</Badge>
        </div>
        {tournamentsQuery.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : loadError ? (
          <Card>
            <CardContent className="p-6 text-sm text-destructive">
              Failed to load tournaments: {loadError instanceof Error ? loadError.message : "Unknown error"}
            </CardContent>
          </Card>
        ) : tournaments.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No tournaments yet. Create one above to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {tournaments.map((tournament) => (
              <TournamentCard key={tournament.id} tournament={tournament} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
