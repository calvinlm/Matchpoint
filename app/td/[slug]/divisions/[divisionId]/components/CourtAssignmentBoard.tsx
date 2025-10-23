"use client";

import React, { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  useBracketSchedule,
  useAssignMatch,
  useRescheduleMatches,
  useRetireMatches,
  useSwapMatches,
  useQueuePause,
  useReorderQueue,
  useSubmitMatchScore,
} from "@/frontend/hooks/useBrackets";
import type { MatchSummary, Bracket } from "@/frontend/hooks/useBrackets";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Props = {
  slug: string;
  bracketId: string;
  config: Bracket["config"];
  token?: string;
};

const QUEUE_DROP_ID = "match-queue";

type ScoreEntryModalProps = {
  match: MatchSummary;
  config: Bracket["config"];
  onCancel: () => void;
  onSubmit: (games: Array<{ team1: number; team2: number }>) => Promise<void> | void;
  isSubmitting: boolean;
};

function ScoreEntryModal({ match, config, onCancel, onSubmit, isSubmitting }: ScoreEntryModalProps) {
  const maxGames = Math.max(1, Number(config?.bestOf ?? 3));
  const requiredWins = Math.max(1, Math.ceil(maxGames / 2));
  const winBy2 = Boolean(config?.winBy2);

  const [gameCount, setGameCount] = useState(requiredWins);
  const [scores, setScores] = useState(
    () => Array.from({ length: maxGames }, () => ({ team1: "", team2: "" })),
  );
  const [formError, setFormError] = useState<string | null>(null);

  const displayed = scores.slice(0, gameCount);

  const teamLabel = (team: MatchSummary["team1"]) => {
    if (!team) return "TBD";
    return team.entryCode ? `${team.entryCode} · ${team.name}` : team.name;
  };

  const adjustGameCount = (direction: "add" | "remove") => {
    setFormError(null);
    setGameCount((current) => (direction === "add" ? Math.min(maxGames, current + 1) : Math.max(1, current - 1)));
  };

  const updateScore = (index: number, side: "team1" | "team2", value: string) => {
    setFormError(null);
    setScores((current) => {
      const next = [...current];
      next[index] = { ...next[index], [side]: value };
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const parsed: Array<{ team1: number; team2: number }> = [];
    for (let i = 0; i < gameCount; i += 1) {
      const current = scores[i];
      const v1 = current.team1.trim();
      const v2 = current.team2.trim();
      if (v1 === "" || v2 === "") return setFormError("Enter scores for every game.");

      const s1 = Number(v1);
      const s2 = Number(v2);
      if (!Number.isInteger(s1) || !Number.isInteger(s2)) return setFormError("Scores must be whole numbers.");
      if (s1 < 0 || s2 < 0) return setFormError("Scores cannot be negative.");

      parsed.push({ team1: s1, team2: s2 });
    }

    if (parsed.length === 0) return setFormError("Add at least one game before submitting the score.");

    try {
      await onSubmit(parsed);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to submit score");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className="w-full max-w-xl shadow-2xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg">Enter Score</CardTitle>
          <p className="text-xs text-muted-foreground">
            {teamLabel(match.team1)} vs {teamLabel(match.team2)} • Best of {maxGames} (first to {requiredWins} wins)
          </p>
          {winBy2 && <p className="text-xs text-muted-foreground">Win by 2 points enforced.</p>}
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-3">
              {displayed.map((game, index) => (
                <div key={`game-${index}`} className="flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-center">
                  <span className="w-20 text-sm font-medium text-muted-foreground">Game {index + 1}</span>
                  <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="flex flex-1 flex-col gap-1">
                      <Label className="text-xs text-muted-foreground">{teamLabel(match.team1)}</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={game.team1}
                        onChange={(e) => updateScore(index, "team1", e.target.value)}
                        min={0}
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <Label className="text-xs text-muted-foreground">{teamLabel(match.team2)}</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={game.team2}
                        onChange={(e) => updateScore(index, "team2", e.target.value)}
                        min={0}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => adjustGameCount("remove")} disabled={gameCount <= 1}>
                  Remove game
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => adjustGameCount("add")} disabled={gameCount >= maxGames}>
                  Add game
                </Button>
              </div>
              <span className="text-xs text-muted-foreground">
                Showing {gameCount} of {maxGames} possible games
              </span>
            </div>

            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Submit score"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

type MatchCardProps = {
  match: MatchSummary;
  onReschedule?: () => void;
  onRetire?: () => void;
  onSwap?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onScore?: () => void;
  onPrint?: () => void;
  disabled?: boolean;
};

function MatchCard({
  match,
  onReschedule,
  onRetire,
  onSwap,
  onMoveUp,
  onMoveDown,
  onScore,
  onPrint,
  disabled = false,
}: MatchCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: match.id,
    data: { matchId: match.id },
  });

  const hasConflicts = (match.conflicts ?? []).length > 0;

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const teamLabel = (team: MatchSummary["team1"]) => (!team ? "TBD" : team.entryCode ? `${team.entryCode} · ${team.name}` : team.name);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "select-none border border-border bg-card text-sm shadow-sm transition",
        hasConflicts ? "border-destructive/50" : "",
        isDragging ? "opacity-75" : "",
      )}
      {...attributes}
      {...listeners}
    >
      <CardContent className="space-y-2 p-3">
        <div>
          <p className="font-semibold text-foreground">{teamLabel(match.team1)}</p>
          <p className="text-sm text-muted-foreground">{teamLabel(match.team2)}</p>
        </div>
        {match.startTime && <p className="text-xs text-muted-foreground">Assigned {new Date(match.startTime).toLocaleTimeString()}</p>}
        {match.priority !== undefined && (onMoveUp || onMoveDown) && <p className="text-xs text-muted-foreground">Priority {match.priority}</p>}
        {hasConflicts && (
          <Alert variant="destructive" className="text-xs">
            <AlertDescription className="space-y-1">
              {match.conflicts?.map((conflict) => {
                const opponentNames = conflict.opponents?.map((t) => t?.name).filter((v): v is string => Boolean(v)).join(", ");
                const sharedPlayers = conflict.sharedPlayers
                  ?.map((p) => [p.firstName, p.lastName].filter(Boolean).join(" "))
                  .filter((name) => name.length > 0)
                  .join(", ");
                return (
                  <div key={`${match.id}-${conflict.matchId}-${conflict.type}`}>
                    Conflict with {opponentNames ?? "another match"}
                    {conflict.type === "PLAYER" && sharedPlayers ? ` — shared player${conflict.sharedPlayers.length > 1 ? "s" : ""}: ${sharedPlayers}` : " (team overlap)"}
                  </div>
                );
              })}
            </AlertDescription>
          </Alert>
        )}
        {(onReschedule || onRetire || onSwap || onScore || onMoveUp || onMoveDown || onPrint) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {onPrint && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onPrint();
                }}
                disabled={disabled}
              >
                Print sheet
              </Button>
            )}
            {onScore && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onScore();
                }}
                disabled={disabled || !match.team1 || !match.team2}
              >
                Enter score
              </Button>
            )}
            {onReschedule && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onReschedule();
                }}
                disabled={disabled}
              >
                Reschedule
              </Button>
            )}
            {onSwap && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onSwap();
                }}
                disabled={disabled}
              >
                Swap
              </Button>
            )}
            {onRetire && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onRetire();
                }}
                disabled={disabled}
              >
                Retire
              </Button>
            )}
            {onMoveUp && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveUp();
                }}
                disabled={disabled}
              >
                Move up
              </Button>
            )}
            {onMoveDown && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveDown();
                }}
                disabled={disabled}
              >
                Move down
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DropZone({
  id,
  children,
  data,
  className,
}: {
  id: string;
  children: React.ReactNode;
  data?: Record<string, unknown>;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data });

  return (
    <div ref={setNodeRef} className={cn(className, isOver ? "ring-2 ring-primary" : "")}>
      {children}
    </div>
  );
}

export function CourtAssignmentBoard({
  slug,
  bracketId,
  config,
  token,
}: Props) {
  // ✅ Call all hooks unconditionally
  const { data, isLoading, isError, error } = useBracketSchedule(slug, bracketId, token);
  const assignMatch = useAssignMatch(slug, bracketId, token);
  const rescheduleMatches = useRescheduleMatches(slug, bracketId, token);
  const retireMatches = useRetireMatches(slug, bracketId, token);
  const swapMatches = useSwapMatches(slug, bracketId, token);
  const queuePause = useQueuePause(slug, bracketId, token);
  const reorderQueue = useReorderQueue(slug, bracketId, token);
  const submitScore = useSubmitMatchScore(slug, bracketId, token);
  const sensors = useSensors(useSensor(PointerSensor));

  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scoreTarget, setScoreTarget] = useState<MatchSummary | null>(null);

  const queueMatches = useMemo(() => data?.queue ?? [], [data?.queue]);

  const busy =
    assignMatch.isLoading ||
    rescheduleMatches.isLoading ||
    retireMatches.isLoading ||
    swapMatches.isLoading ||
    queuePause.isLoading ||
    reorderQueue.isLoading ||
    submitScore.isLoading;

  const handleAssignTop = React.useCallback(async () => {
    if (!data) return;

    if (queueMatches.length === 0) {
      setErrorMessage("No queued matches available to assign.");
      return;
    }

    const availableCourt = data.courts.find((court) => court.active && !court.assignment);
    if (!availableCourt) {
      setErrorMessage("No active courts available for assignment.");
      return;
    }

    const topMatch = queueMatches[0];

    try {
      setFeedback(null);
      setErrorMessage(null);
      await assignMatch.mutateAsync({
        matchId: topMatch.id,
        payload: { courtId: availableCourt.id, startTime: new Date().toISOString() },
      });
      setFeedback(`Assigned match to Court ${availableCourt.label}`);
    } catch (err) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : "Failed to assign match");
    }
  }, [assignMatch, data, queueMatches]);

  const handleRetireTop = React.useCallback(async () => {
    if (queueMatches.length === 0) {
      setErrorMessage("No queued matches available to retire.");
      return;
    }

    const topMatch = queueMatches[0];

    try {
      setFeedback(null);
      setErrorMessage(null);
      await retireMatches.mutateAsync({ matchIds: [topMatch.id] });
      setFeedback("Match retired");
    } catch (err) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : "Failed to retire match");
    }
  }, [queueMatches, retireMatches]);

  const handleCycleQueue = React.useCallback(async () => {
    if (queueMatches.length < 2) {
      setErrorMessage("Need at least two queued matches to advance.");
      return;
    }

    const ids = queueMatches.map((m) => m.id);
    const [first, ...rest] = ids;
    const nextOrder = [...rest, first];

    try {
      setFeedback(null);
      setErrorMessage(null);
      await reorderQueue.mutateAsync({ order: nextOrder });
      setFeedback("Queue advanced");
    } catch (err) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : "Failed to reorder queue");
    }
  }, [queueMatches, reorderQueue]);

  const openScoreEntry = React.useCallback((match: MatchSummary) => {
    submitScore.reset();
    setFeedback(null);
    setErrorMessage(null);
    setScoreTarget(match);
  }, [submitScore]);

  const openPrintSheet = React.useCallback((match: MatchSummary) => {
    const url = `/td/${slug}/matches/${match.id}/print`;
    window.open(url, "_blank", "noopener");
  }, [slug]);

  const handleSubmitScore = React.useCallback(
    async (games: Array<{ team1: number; team2: number }>) => {
      if (!scoreTarget) throw new Error("No match selected for scoring.");

      setFeedback(null);
      setErrorMessage(null);
      await submitScore.mutateAsync({ matchId: scoreTarget.id, payload: { games } });
      setScoreTarget(null);
      setFeedback("Score recorded");
    },
    [scoreTarget, submitScore],
  );

  const closeScoreEntry = React.useCallback(() => {
    submitScore.reset();
    setScoreTarget(null);
  }, [submitScore]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { over, active } = event;
    if (!over || !active.data.current?.matchId) return;

    const matchId = String(active.data.current.matchId);
    let courtId: string | null = null;

    if (over.id === QUEUE_DROP_ID) {
      courtId = null;
    } else if (over.data?.current && over.data.current.type === "court" && typeof over.data.current.courtId === "string") {
      if (over.data.current.active === false) {
        setErrorMessage("Cannot assign to an inactive court.");
        return;
      }
      const isQueueMatch = queueMatches.some((m) => m.id === matchId);
      if (isQueueMatch && data?.queuePaused) {
        setErrorMessage("Queue is paused. Resume before assigning matches.");
        return;
      }
      courtId = over.data.current.courtId;
    } else {
      return;
    }

    try {
      setFeedback(null);
      setErrorMessage(null);
      await assignMatch.mutateAsync({
        matchId,
        payload: { courtId, startTime: courtId ? new Date().toISOString() : null },
      });
      setFeedback(courtId ? "Match assigned to court" : "Match returned to queue");
    } catch (assignmentError) {
      console.error(assignmentError);
      setErrorMessage(assignmentError instanceof Error ? assignmentError.message : "Unknown error");
    }
  };

  const handleReschedule = async (match: MatchSummary) => {
    const next = window.prompt("Enter new start time (ISO 8601) or leave blank to clear:", match.startTime ?? "");
    if (next === null) return;

    const trimmed = next.trim();
    const startTime = trimmed === "" ? null : trimmed;

    try {
      setFeedback(null);
      setErrorMessage(null);
      await rescheduleMatches.mutateAsync({ updates: [{ matchId: match.id, startTime }] });
      setFeedback("Match rescheduled");
    } catch (err) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const handleRetire = async (match: MatchSummary) => {
    if (!window.confirm("Retire this match?")) return;

    try {
      setFeedback(null);
      setErrorMessage(null);
      await retireMatches.mutateAsync({ matchIds: [match.id] });
      setFeedback("Match retired");
    } catch (err) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const handleSwap = async (match: MatchSummary) => {
    const other = window.prompt("Enter the match ID to swap courts with:");
    if (!other || other.trim() === "") return;

    try {
      setFeedback(null);
      setErrorMessage(null);
      await swapMatches.mutateAsync({ matchAId: match.id, matchBId: other.trim() });
      setFeedback("Matches swapped");
    } catch (err) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const handleQueueToggle = async () => {
    try {
      setFeedback(null);
      setErrorMessage(null);
      await queuePause.mutateAsync(!data?.queuePaused);
      setFeedback(data?.queuePaused ? "Queue resumed" : "Queue paused");
    } catch (err) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const updateQueueOrder = async (matchId: string, direction: "up" | "down") => {
    const ids = queueMatches.map((m) => m.id);
    const index = ids.indexOf(matchId);
    if (index === -1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= ids.length) return;

    const nextOrder = [...ids];
    [nextOrder[index], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[index]];

    try {
      setFeedback(null);
      setErrorMessage(null);
      await reorderQueue.mutateAsync({ order: nextOrder });
      setFeedback("Queue order updated");
    } catch (err) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
    }
  };

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!event.shiftKey) return;

      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      switch (event.key.toLowerCase()) {
        case "a":
          event.preventDefault();
          if (!busy) handleAssignTop();
          break;
        case "r":
          event.preventDefault();
          if (!busy) handleRetireTop();
          break;
        case "n":
          event.preventDefault();
          if (!busy) handleCycleQueue();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [busy, handleAssignTop, handleRetireTop, handleCycleQueue]);

  // ✅ Single return, branch only in JSX
  return (
    <section className="space-y-4">
      {isLoading ? (
        <>
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Court assignments</h3>
              <p className="text-xs text-muted-foreground">
                Shortcuts: Shift+A assign top match • Shift+R retire top match • Shift+N advance queue order
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Loading…</Badge>
            </div>
          </header>
          <div className="space-y-4">
            <Skeleton className="h-6 w-40" />
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          </div>
        </>
      ) : isError ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load schedule</AlertTitle>
          <AlertDescription>{error instanceof Error ? error.message : "Unknown error"}</AlertDescription>
        </Alert>
      ) : !data ? (
        null
      ) : (
        <>
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Court assignments</h3>
              <p className="text-xs text-muted-foreground">
                Shortcuts: Shift+A assign top match • Shift+R retire top match • Shift+N advance queue order
              </p>
            </div>
            <div className="flex items-center gap-2">
              {busy && <Badge variant="outline">Working…</Badge>}
              <Button variant={data.queuePaused ? "destructive" : "default"} size="sm" onClick={handleQueueToggle} disabled={queuePause.isLoading}>
                {queuePause.isLoading ? "Updating…" : data.queuePaused ? "Resume queue" : "Pause queue"}
              </Button>
            </div>
          </header>

          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="grid gap-4 md:grid-cols-[2fr,3fr]">
              <DropZone
                id={QUEUE_DROP_ID}
                className="h-full rounded-lg border border-dashed border-border bg-muted/40 p-4 transition"
                data={{ type: "queue" }}
              >
                <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Ready queue</h4>
                {data.queuePaused && (
                  <Alert className="mt-3" variant="default">
                    <AlertDescription className="text-xs">Queue is paused. Resume to assign new matches.</AlertDescription>
                  </Alert>
                )}
                <div className="mt-3 space-y-3">
                  {queueMatches.length === 0 && (
                    <p className="text-sm text-muted-foreground">No matches waiting. Drag from courts to send a match back to the queue.</p>
                  )}
                  {queueMatches.map((match, index) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      onReschedule={() => handleReschedule(match)}
                      onRetire={() => handleRetire(match)}
                      onMoveUp={index > 0 ? () => updateQueueOrder(match.id, "up") : undefined}
                      onMoveDown={index < queueMatches.length - 1 ? () => updateQueueOrder(match.id, "down") : undefined}
                      onPrint={() => openPrintSheet(match)}
                      disabled={busy}
                    />
                  ))}
                </div>
              </DropZone>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Courts</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.courts.map((court) => (
                    <DropZone
                      key={court.id}
                      id={`court-${court.id}`}
                      className="rounded-lg border border-border bg-card p-3 transition"
                      data={{ type: "court", courtId: court.id, active: court.active }}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-semibold">Court {court.label}</span>
                        {!court.active && <Badge variant="destructive">Inactive</Badge>}
                      </div>

                      {court.assignment ? (
                        <MatchCard
                          match={court.assignment}
                          onReschedule={() => handleReschedule(court.assignment)}
                          onRetire={() => handleRetire(court.assignment)}
                          onSwap={() => handleSwap(court.assignment)}
                          onPrint={() => openPrintSheet(court.assignment)}
                          onScore={() => openScoreEntry(court.assignment)}
                          disabled={busy}
                        />
                      ) : (
                        <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                          Drag a match here to assign this court.
                        </div>
                      )}
                    </DropZone>
                  ))}
                </div>
              </div>
            </div>
          </DndContext>

          {errorMessage && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
          {feedback && !errorMessage && (
            <Alert>
              <AlertDescription>{feedback}</AlertDescription>
            </Alert>
          )}
          {scoreTarget && (
            <ScoreEntryModal
              match={scoreTarget}
              config={config}
              onCancel={closeScoreEntry}
              onSubmit={handleSubmitScore}
              isSubmitting={submitScore.isLoading}
            />
          )}
        </>
      )}
    </section>
  );
}
