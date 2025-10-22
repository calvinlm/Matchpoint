"use client";

import React, { useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useDivisionTeams,
  useApplySeeding,
  TeamWithSeed,
} from "@/frontend/hooks/useBrackets";

type Props = {
  slug: string;
  divisionId: string;
  bracketId: string;
  token?: string;
};

function SeedRow({
  teamId,
  name,
  seed,
}: {
  teamId: string;
  name: string;
  seed: number | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: teamId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between rounded border px-3 py-2"
      {...attributes}
      {...listeners}
    >
      <span>{name}</span>
      <span className="text-sm text-gray-500">Seed {seed ?? "—"}</span>
    </li>
  );
}

export function BracketSeedingBoard({
  slug,
  divisionId,
  bracketId,
  token,
}: Props) {
  const { data, isLoading, isError, error } = useDivisionTeams(
    slug,
    divisionId,
    bracketId,
    token,
  );
  const applySeeding = useApplySeeding(slug, bracketId, divisionId, token);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const initialOrderedTeams = useMemo(() => {
    const seeded =
      data?.teams
        .filter((team) => team.seed != null)
        .sort((a, b) => (a.seed ?? 0) - (b.seed ?? 0)) ?? [];
    const unseeded = data?.teams.filter((team) => team.seed == null) ?? [];
    return [...seeded, ...unseeded];
  }, [data]);

  const [orderedTeams, setOrderedTeams] =
    useState<TeamWithSeed[]>(initialOrderedTeams);

  React.useEffect(() => {
    setOrderedTeams(initialOrderedTeams);
  }, [initialOrderedTeams]);

  const sensors = useSensors(useSensor(PointerSensor));

  if (isLoading) {
    return <div>Loading teams…</div>;
  }

  if (isError) {
    return (
      <div className="text-red-600">
        Failed to load teams:{" "}
        {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  if (!orderedTeams.length) {
    return <div>No registered teams for this division.</div>;
  }

  const handleDragEnd = (
    event: Parameters<NonNullable<DndContext["props"]["onDragEnd"]>>[0],
  ) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = orderedTeams.findIndex(
      (team) => team.teamId === active.id,
    );
    const newIndex = orderedTeams.findIndex((team) => team.teamId === over.id);

    setOrderedTeams((teams) => arrayMove(teams, oldIndex, newIndex));
  };

  const handleSave = async () => {
    const entries = orderedTeams.map((team, index) => ({
      teamId: team.teamId,
      seed: index + 1,
    }));

    try {
      setStatusMessage(null);
      setErrorMessage(null);
      await applySeeding.mutateAsync({ entries });
      setStatusMessage('Seeding saved');
    } catch (err) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Seeding Order</h3>
        <button
          type="button"
          className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-60"
          onClick={handleSave}
          disabled={applySeeding.isLoading}
        >
          {applySeeding.isLoading ? "Saving…" : "Save seeding"}
        </button>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={orderedTeams.map((team) => team.teamId)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-2">
            {orderedTeams.map((team) => (
              <SeedRow
                key={team.teamId}
                teamId={team.teamId}
                name={team.teamName}
                seed={
                  orderedTeams.findIndex((t) => t.teamId === team.teamId) + 1
                }
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {applySeeding.isError && (
        <p className="text-sm text-red-600">
          Failed to save seeding:{" "}
          {applySeeding.error instanceof Error
            ? applySeeding.error.message
            : "Unknown error"}
        </p>
      )}
      {errorMessage && (
        <p className="text-sm text-red-600">{errorMessage}</p>
      )}
      {statusMessage && !applySeeding.isError && (
        <p className="text-sm text-emerald-600">{statusMessage}</p>
      )}
    </section>
  );
}
