"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useTournamentTeams, useUpdateTeam, useDeleteTeam } from "@/frontend/hooks/useTeams";
import {
  useTournamentDivisions,
  useCreateRegistration,
  useDeleteRegistration,
} from "@/frontend/hooks/useTournamentAdmin";
import type { Team } from "@/frontend/api/teams";

function RegistrationForm({ slug }: { slug: string }) {
  const divisionsQuery = useTournamentDivisions(slug);
  const createRegistration = useCreateRegistration(slug);
  const [players, setPlayers] = React.useState([
    { firstName: "", lastName: "", dateOfBirth: "" },
    { firstName: "", lastName: "", dateOfBirth: "" },
  ]);
  const [divisionId, setDivisionId] = React.useState("");
  const [teamName, setTeamName] = React.useState("");
  const [seedNote, setSeedNote] = React.useState("");

  const updatePlayer = (index: number, key: "firstName" | "lastName" | "dateOfBirth", value: string) => {
    setPlayers((prev) => prev.map((player, idx) => (idx === index ? { ...player, [key]: value } : player)));
  };

  const addPlayerRow = () => {
    setPlayers((prev) => [...prev, { firstName: "", lastName: "", dateOfBirth: "" }]);
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    if (!divisionId || !teamName.trim()) {
      return;
    }

    const filteredPlayers = players
      .filter((player) => player.firstName.trim() || player.lastName.trim())
      .map((player) => ({
        firstName: player.firstName.trim(),
        lastName: player.lastName.trim(),
        dateOfBirth: player.dateOfBirth || null,
      }));

    createRegistration.mutate(
      {
        divisionId,
        payload: {
          team: {
            name: teamName.trim(),
            players: filteredPlayers,
          },
          seedNote: seedNote.trim() || null,
        },
      },
      {
        onSuccess: () => {
          setDivisionId("");
          setTeamName("");
          setSeedNote("");
          setPlayers([
            { firstName: "", lastName: "", dateOfBirth: "" },
            { firstName: "", lastName: "", dateOfBirth: "" },
          ]);
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Register a team</CardTitle>
        <CardDescription>Create a team and attach it to a division. Players are optional but recommended.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="team-name">Team name</Label>
              <Input
                id="team-name"
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
                placeholder="Pickleball Aces"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="division-select">Division</Label>
              <select
                id="division-select"
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={divisionId}
                onChange={(event) => setDivisionId(event.target.value)}
                required
              >
                <option value="" disabled>
                  Select division
                </option>
                {divisionsQuery.data?.divisions.map((division) => (
                  <option key={division.id} value={division.id}>
                    {division.name} • {division.level} • {division.ageGroup}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="seed-note">Seed note</Label>
            <Input
              id="seed-note"
              value={seedNote}
              onChange={(event) => setSeedNote(event.target.value)}
              placeholder="Returning champions"
            />
          </div>

  <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Players</p>
              <Button type="button" variant="outline" size="sm" onClick={addPlayerRow}>
                Add player
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {players.map((player, index) => (
                <div key={`player-${index}`} className="space-y-2">
                  <Input
                    placeholder="First name"
                    value={player.firstName}
                    onChange={(event) => updatePlayer(index, "firstName", event.target.value)}
                  />
                  <Input
                    placeholder="Last name"
                    value={player.lastName}
                    onChange={(event) => updatePlayer(index, "lastName", event.target.value)}
                  />
                  <Input
                    type="date"
                    value={player.dateOfBirth}
                    onChange={(event) => updatePlayer(index, "dateOfBirth", event.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          {createRegistration.error && (
            <p className="text-sm text-destructive">{createRegistration.error.message}</p>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={createRegistration.isPending || !divisionId}>
              {createRegistration.isPending ? "Registering…" : "Register team"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function TeamCard({ slug, team }: { slug: string; team: Team }) {
  const updateTeam = useUpdateTeam(team.id);
  const deleteTeam = useDeleteTeam();
  const deleteRegistration = useDeleteRegistration(slug);
  const [isEditing, setIsEditing] = React.useState(false);
  const [form, setForm] = React.useState({
    name: team.name,
    players: team.players.map((player) => ({
      firstName: player.firstName,
      lastName: player.lastName,
      dateOfBirth: player.dateOfBirth ? player.dateOfBirth.slice(0, 10) : "",
    })),
  });

  const updatePlayerField = (index: number, key: "firstName" | "lastName" | "dateOfBirth", value: string) => {
    setForm((prev) => ({
      ...prev,
      players: prev.players.map((player, idx) => (idx === index ? { ...player, [key]: value } : player)),
    }));
  };

  const addPlayer = () => {
    setForm((prev) => ({ ...prev, players: [...prev.players, { firstName: "", lastName: "", dateOfBirth: "" }] }));
  };

  const handleUpdate: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    const roster = form.players
      .filter((player) => player.firstName.trim() || player.lastName.trim())
      .map((player) => ({
        firstName: player.firstName.trim(),
        lastName: player.lastName.trim(),
        dateOfBirth: player.dateOfBirth || null,
      }));

    updateTeam.mutate(
      {
        name: form.name.trim(),
        players: roster,
      },
      {
        onSuccess: () => setIsEditing(false),
      },
    );
  };

  const handleRemoveRegistration = (divisionId: string, registrationId: string) => {
    if (!window.confirm("Remove this team from the division?")) {
      return;
    }
    deleteRegistration.mutate({ divisionId, registrationId });
  };

  const handleDeleteTeam = () => {
    if (!window.confirm("Delete this team and all registrations?")) {
      return;
    }
    deleteTeam.mutate(team.id);
  };

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="text-lg font-semibold leading-tight">{team.name}</CardTitle>
          <CardDescription>{team.players.length} player{team.players.length === 1 ? "" : "s"}</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => setIsEditing((prev) => !prev)}>
            {isEditing ? "Close edit" : "Edit team"}
          </Button>
          <Button size="sm" variant="destructive" onClick={handleDeleteTeam} disabled={deleteTeam.isPending}>
            Delete team
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Registrations</p>
          {team.registrations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not yet registered for any division.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {team.registrations.map((registration) => (
                <Badge key={registration.id} variant="secondary" className="flex items-center gap-2">
                  <span>
                    {registration.entryCode} ({registration.divisionName ?? "Unknown division"})
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-5 px-1 text-[11px]"
                    onClick={() => handleRemoveRegistration(registration.divisionId, registration.id)}
                    disabled={deleteRegistration.isPending}
                  >
                    Remove
                  </Button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Players</p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {team.players.length === 0 ? (
              <li>No players recorded.</li>
            ) : (
              team.players.map((player) => (
                <li key={player.id}>
                  {player.firstName} {player.lastName}
                  {player.dateOfBirth && (
                    <span className="text-xs text-muted-foreground"> • DOB {new Date(player.dateOfBirth).toLocaleDateString()}</span>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>

        {isEditing ? (
          <form className="space-y-3" onSubmit={handleUpdate}>
            <div className="space-y-1">
              <Label htmlFor={`team-name-${team.id}`}>Team name</Label>
              <Input
                id={`team-name-${team.id}`}
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Players</Label>
                <Button type="button" size="sm" variant="outline" onClick={addPlayer}>
                  Add player
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {form.players.map((player, index) => (
                  <div key={`edit-player-${index}`} className="space-y-2">
                    <Input
                      placeholder="First name"
                      value={player.firstName}
                      onChange={(event) => updatePlayerField(index, "firstName", event.target.value)}
                    />
                    <Input
                      placeholder="Last name"
                      value={player.lastName}
                      onChange={(event) => updatePlayerField(index, "lastName", event.target.value)}
                    />
                    <Input
                      type="date"
                      value={player.dateOfBirth}
                      onChange={(event) => updatePlayerField(index, "dateOfBirth", event.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
            {(updateTeam.error || deleteTeam.error) && (
              <p className="text-sm text-destructive">
                {updateTeam.error instanceof Error
                  ? updateTeam.error.message
                  : deleteTeam.error instanceof Error
                    ? deleteTeam.error.message
                    : "Unable to update team"}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateTeam.isPending}>
                {updateTeam.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function TeamsPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const teamsQuery = useTournamentTeams(slug);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Teams & registrations</h1>
        <p className="text-sm text-muted-foreground">
          Create teams, attach them to divisions, and manage their rosters.
        </p>
      </header>

      <RegistrationForm slug={slug} />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Registered teams</h2>
          <Badge variant="outline">{teamsQuery.data?.teams.length ?? 0}</Badge>
        </div>
        {teamsQuery.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : teamsQuery.data?.teams.length ? (
          <div className="space-y-4">
            {teamsQuery.data.teams.map((team) => (
              <TeamCard key={team.id} slug={slug} team={team} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No teams registered yet. Use the form above to add the first team.
            </CardContent>
          </Card>
        )}
      </section>
    </main>
  );
}
