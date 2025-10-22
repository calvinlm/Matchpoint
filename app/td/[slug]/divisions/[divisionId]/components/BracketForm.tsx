"use client";

import React, { useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useCreateBracket } from "@/frontend/hooks/useBrackets";
import type { CreateBracketPayload } from "@/frontend/hooks/useBrackets";

const BRACKET_TYPES = [
  "SINGLE_ELIMINATION",
  "DOUBLE_ELIMINATION",
  "ROUND_ROBIN",
] as const;

type Props = {
  slug: string;
  divisionId: string;
  token?: string;
};

const defaultConfigForType = (type: string): CreateBracketPayload["config"] => {
  switch (type) {
    case "DOUBLE_ELIMINATION":
      return {
        bestOf: 3,
        winBy2: true,
        rounds: [
          { name: "Winners Round 1", matchCount: 4 },
          { name: "Winners Round 2", matchCount: 2 },
          { name: "Winners Final", matchCount: 1 },
        ],
        finalsReset: true,
      };
    case "ROUND_ROBIN":
      return {
        bestOf: 3,
        winBy2: true,
        groups: 2,
        groupSize: 4,
      };
    case "SINGLE_ELIMINATION":
    default:
      return {
        bestOf: 3,
        winBy2: true,
        rounds: [
          { name: "Semifinals", matchCount: 2 },
          { name: "Final", matchCount: 1 },
        ],
      };
  }
};

export function BracketForm({ slug, divisionId, token }: Props) {
  const [type, setType] =
    useState<(typeof BRACKET_TYPES)[number]>("SINGLE_ELIMINATION");
  const [bestOf, setBestOf] = useState(3);
  const [winBy2, setWinBy2] = useState(true);
  const [finalsReset, setFinalsReset] = useState(true);
  const [groups, setGroups] = useState(2);
  const [groupSize, setGroupSize] = useState(4);
  const [rounds, setRounds] = useState(
    () => defaultConfigForType("SINGLE_ELIMINATION").rounds ?? [],
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useCreateBracket(slug, divisionId, token);

  const isElimination =
    type === "SINGLE_ELIMINATION" || type === "DOUBLE_ELIMINATION";
  const isRoundRobin = type === "ROUND_ROBIN";

  const handleTypeChange = (nextType: (typeof BRACKET_TYPES)[number]) => {
    setType(nextType);
    const defaultConfig = defaultConfigForType(nextType);
    setBestOf(defaultConfig.bestOf);
    setWinBy2(defaultConfig.winBy2);
    setFinalsReset(defaultConfig.finalsReset ?? true);
    setGroups(defaultConfig.groups ?? 2);
    setGroupSize(defaultConfig.groupSize ?? 4);
    setRounds(defaultConfig.rounds ?? []);
  };

  const payload: CreateBracketPayload = useMemo(() => {
    const base = {
      type,
      config: {
        bestOf,
        winBy2,
      } as CreateBracketPayload["config"],
    };

    if (isElimination) {
      base.config.rounds = rounds;
      if (type === "DOUBLE_ELIMINATION") {
        base.config.finalsReset = finalsReset;
      }
    }

    if (isRoundRobin) {
      base.config.groups = groups;
      base.config.groupSize = groupSize;
    }

    return base;
  }, [
    type,
    bestOf,
    winBy2,
    finalsReset,
    groups,
    groupSize,
    rounds,
    isElimination,
    isRoundRobin,
  ]);

  const addRound = () => {
    setRounds((prev) => [
      ...prev,
      { name: `Round ${prev.length + 1}`, matchCount: 1 },
    ]);
  };

  const updateRound = (
    index: number,
    key: "name" | "matchCount",
    value: string,
  ) => {
    setRounds((prev) =>
      prev.map((round, idx) =>
        idx === index
          ? {
              ...round,
              [key]: key === "matchCount" ? Number(value) : value,
            }
          : round,
      ),
    );
  };

  const removeRound = (index: number) => {
    setRounds((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (
    event,
  ) => {
    event.preventDefault();
    try {
      setSuccessMessage(null);
      setErrorMessage(null);
      await mutation.mutateAsync(payload);
      setSuccessMessage("Bracket created");
      handleTypeChange(type);
    } catch (err) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Bracket</CardTitle>
        <CardDescription>Configure a new bracket for this division.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bracket-type">Type</Label>
              <select
                id="bracket-type"
                value={type}
                onChange={(event) => handleTypeChange(event.target.value as (typeof BRACKET_TYPES)[number])}
                className={cn(
                  "h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                )}
              >
                {BRACKET_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {option.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bracket-best-of">Best of</Label>
              <Input
                id="bracket-best-of"
                type="number"
                min={1}
                value={bestOf}
                onChange={(event) => setBestOf(Number(event.target.value))}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-4 py-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Win by 2</Label>
                <p className="text-xs text-muted-foreground">Enforce a two-point margin for all games.</p>
              </div>
              <Switch checked={winBy2} onCheckedChange={setWinBy2} />
            </div>
            {type === "DOUBLE_ELIMINATION" && (
              <div className="flex items-center justify-between rounded-md border border-border px-4 py-3">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Finals reset match</Label>
                  <p className="text-xs text-muted-foreground">Include an extra match if the challenger wins.</p>
                </div>
                <Switch checked={finalsReset} onCheckedChange={setFinalsReset} />
              </div>
            )}

            {isRoundRobin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="round-robin-groups">Groups</Label>
                  <Input
                    id="round-robin-groups"
                    type="number"
                    min={1}
                    value={groups}
                    onChange={(event) => setGroups(Number(event.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="round-robin-group-size">Group size</Label>
                  <Input
                    id="round-robin-group-size"
                    type="number"
                    min={1}
                    value={groupSize}
                    onChange={(event) => setGroupSize(Number(event.target.value))}
                  />
                </div>
              </>
            )}
          </div>

          {isElimination && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Rounds</p>
                <Button type="button" variant="ghost" size="sm" onClick={addRound}>
                  Add round
                </Button>
              </div>
              <div className="space-y-2">
                {rounds.map((round, index) => (
                  <div key={index} className="grid gap-2 md:grid-cols-[2fr,1fr,auto]">
                    <Input
                      value={round.name}
                      onChange={(event) => updateRound(index, "name", event.target.value)}
                      placeholder="Round name"
                    />
                    <Input
                      type="number"
                      min={1}
                      value={round.matchCount}
                      onChange={(event) => updateRound(index, "matchCount", event.target.value)}
                      placeholder="Match count"
                    />
                    <Button type="button" variant="destructive" size="sm" onClick={() => removeRound(index)}>
                      Remove
                    </Button>
                  </div>
                ))}
                {rounds.length === 0 && (
                  <p className="text-sm text-muted-foreground">No rounds defined yet. Add at least one round.</p>
                )}
              </div>
            </div>
          )}

          <Button type="submit" className="w-full sm:w-auto" disabled={mutation.isLoading}>
            {mutation.isLoading ? "Creating…" : "Create bracket"}
          </Button>

          {(mutation.isError || errorMessage) && (
            <Alert variant="destructive">
              <AlertTitle>Failed to create bracket</AlertTitle>
              <AlertDescription>
                {mutation.error instanceof Error
                  ? mutation.error.message
                  : errorMessage ?? "Unknown error"}
              </AlertDescription>
            </Alert>
          )}
          {successMessage && !mutation.isError && (
            <Alert>
              <AlertTitle>Bracket created</AlertTitle>
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
