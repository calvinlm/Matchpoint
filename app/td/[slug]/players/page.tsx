"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  usePlayers,
  useCreatePlayer,
  useUpdatePlayer,
  useDeletePlayer,
} from "@/frontend/hooks/usePlayers";
import type { Player } from "@/frontend/api/players";

function PlayerCreateForm() {
  const [form, setForm] = React.useState({
    firstName: "",
    lastName: "",
    gender: "",
    dateOfBirth: "",
  });
  const createPlayer = useCreatePlayer();

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      return;
    }

    createPlayer.mutate(
      {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        gender: form.gender.trim() || null,
        dateOfBirth: form.dateOfBirth || null,
      },
      {
        onSuccess: () => setForm({ firstName: "", lastName: "", gender: "", dateOfBirth: "" }),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add player</CardTitle>
        <CardDescription>Create a player record for roster management.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="player-first-name">First name</Label>
            <Input
              id="player-first-name"
              value={form.firstName}
              onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="player-last-name">Last name</Label>
            <Input
              id="player-last-name"
              value={form.lastName}
              onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="player-gender">Gender (optional)</Label>
            <Input
              id="player-gender"
              value={form.gender}
              onChange={(event) => setForm((prev) => ({ ...prev, gender: event.target.value }))}
              placeholder="F / M / X"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="player-dob">Date of birth</Label>
            <Input
              id="player-dob"
              type="date"
              value={form.dateOfBirth}
              onChange={(event) => setForm((prev) => ({ ...prev, dateOfBirth: event.target.value }))}
            />
          </div>
          {createPlayer.error && (
            <p className="md:col-span-2 text-sm text-destructive">{createPlayer.error.message}</p>
          )}
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" disabled={createPlayer.isPending}>
              {createPlayer.isPending ? "Saving…" : "Create player"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PlayerCard({ player }: { player: Player }) {
  const updatePlayer = useUpdatePlayer(player.id);
  const deletePlayer = useDeletePlayer();
  const [isEditing, setIsEditing] = React.useState(false);
  const [form, setForm] = React.useState({
    firstName: player.firstName,
    lastName: player.lastName,
    gender: player.gender ?? "",
    dateOfBirth: player.dateOfBirth ? player.dateOfBirth.slice(0, 10) : "",
  });

  const handleUpdate: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    updatePlayer.mutate(
      {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        gender: form.gender.trim() || null,
        dateOfBirth: form.dateOfBirth || null,
      },
      {
        onSuccess: () => setIsEditing(false),
      },
    );
  };

  const handleDelete = () => {
    if (!window.confirm("Delete this player? They will be removed from all teams.")) {
      return;
    }
    deletePlayer.mutate(player.id);
  };

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="text-lg font-semibold">
            {player.firstName} {player.lastName}
          </CardTitle>
          <CardDescription>
            {player.gender ?? "Gender unknown"}
            {player.dateOfBirth && (
              <>
                {" "}• DOB {new Date(player.dateOfBirth).toLocaleDateString()}
              </>
            )}
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setIsEditing((prev) => !prev)}>
            {isEditing ? "Close" : "Edit"}
          </Button>
          <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deletePlayer.isPending}>
            Delete
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>Teams:</p>
          <ul className="space-y-1">
            {player.teams.length === 0 ? (
              <li>No team associations</li>
            ) : (
              player.teams.map((team) => (
                <li key={team.teamId}>{team.teamName ?? team.teamId}</li>
              ))
            )}
          </ul>
        </div>
        {isEditing ? (
          <form className="grid gap-3 md:grid-cols-2" onSubmit={handleUpdate}>
            <div className="space-y-2">
              <Label htmlFor={`player-first-${player.id}`}>First name</Label>
              <Input
                id={`player-first-${player.id}`}
                value={form.firstName}
                onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`player-last-${player.id}`}>Last name</Label>
              <Input
                id={`player-last-${player.id}`}
                value={form.lastName}
                onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`player-gender-${player.id}`}>Gender</Label>
              <Input
                id={`player-gender-${player.id}`}
                value={form.gender}
                onChange={(event) => setForm((prev) => ({ ...prev, gender: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`player-dob-${player.id}`}>Date of birth</Label>
              <Input
                id={`player-dob-${player.id}`}
                type="date"
                value={form.dateOfBirth}
                onChange={(event) => setForm((prev) => ({ ...prev, dateOfBirth: event.target.value }))}
              />
            </div>
            {(updatePlayer.error || deletePlayer.error) && (
              <p className="md:col-span-2 text-sm text-destructive">
                {updatePlayer.error instanceof Error
                  ? updatePlayer.error.message
                  : deletePlayer.error instanceof Error
                    ? deletePlayer.error.message
                    : "Unable to update player"}
              </p>
            )}
            <div className="md:col-span-2 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updatePlayer.isPending}>
                {updatePlayer.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function PlayersPage() {
  const [search, setSearch] = React.useState("");
  const playersQuery = usePlayers(search);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Players</h1>
        <p className="text-sm text-muted-foreground">Maintain the player directory used by team rosters and seeding.</p>
      </header>

      <PlayerCreateForm />

      <Card>
        <CardHeader>
          <CardTitle>Search</CardTitle>
          <CardDescription>Filter players by name.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Search players"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Player directory</h2>
          <Badge variant="outline">{playersQuery.data?.players.length ?? 0}</Badge>
        </div>
        {playersQuery.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : playersQuery.data?.players.length ? (
          <div className="space-y-4">
            {playersQuery.data.players.map((player) => (
              <PlayerCard key={player.id} player={player} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No players found. Adjust your search or create a new player above.
            </CardContent>
          </Card>
        )}
      </section>
    </main>
  );
}
