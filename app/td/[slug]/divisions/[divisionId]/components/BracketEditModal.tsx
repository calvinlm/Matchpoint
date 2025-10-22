"use client";

import React, { useEffect, useMemo, useState } from "react";
import type {
  Bracket,
  UpdateBracketPayload,
} from "@/frontend/hooks/useBrackets";
import { useUpdateBracket } from "@/frontend/hooks/useBrackets";

const BRACKET_TYPES = [
  "SINGLE_ELIMINATION",
  "DOUBLE_ELIMINATION",
  "ROUND_ROBIN",
] as const;

interface Props {
  slug: string;
  bracket: Bracket;
  onClose: () => void;
  token?: string;
}

const emptyRound = (idx: number) => ({
  name: `Round ${idx + 1}`,
  matchCount: 1,
});

export function BracketEditModal({ slug, bracket, onClose, token }: Props) {
  const [payload, setPayload] = useState<UpdateBracketPayload>({
    config: bracket.config,
  });

  const updateMutation = useUpdateBracket(slug, token);

  const isElimination =
    bracket.type === "SINGLE_ELIMINATION" ||
    bracket.type === "DOUBLE_ELIMINATION";
  const isRoundRobin = bracket.type === "ROUND_ROBIN";

  useEffect(() => {
    setPayload({ config: bracket.config });
  }, [bracket]);

  const config = payload.config ?? bracket.config;

  const setConfig = (next: UpdateBracketPayload["config"]) => {
    setPayload((prev) => ({
      ...prev,
      config: next,
    }));
  };

  const updateConfigField = <K extends keyof UpdateBracketPayload["config"]>(
    key: K,
    value: UpdateBracketPayload["config"][K],
  ) => {
    setConfig({
      ...config,
      [key]: value,
    });
  };

  const rounds = useMemo(() => config.rounds ?? [], [config.rounds]);

  const addRound = () => {
    const next = [...rounds, emptyRound(rounds.length)];
    updateConfigField("rounds", next);
  };

  const changeRound = (
    index: number,
    key: "name" | "matchCount",
    value: string,
  ) => {
    const next = rounds.map((round, idx) =>
      idx === index
        ? {
            ...round,
            [key]: key === "matchCount" ? Number(value) : value,
          }
        : round,
    );
    updateConfigField("rounds", next);
  };

  const removeRound = (index: number) => {
    updateConfigField(
      "rounds",
      rounds.filter((_, idx) => idx !== index),
    );
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (
    event,
  ) => {
    event.preventDefault();
    try {
      await updateMutation.mutateAsync({
        bracketId: bracket.id,
        payload,
      });
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={handleSubmit}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded bg-white p-6 shadow-lg space-y-4"
      >
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Edit {bracket.type.replace(/_/g, " ")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-500"
          >
            Close
          </button>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Best of
            <input
              type="number"
              min={1}
              value={config.bestOf}
              onChange={(event) =>
                updateConfigField("bestOf", Number(event.target.value))
              }
              className="rounded border px-2 py-1"
            />
          </label>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={config.winBy2}
              onChange={(event) =>
                updateConfigField("winBy2", event.target.checked)
              }
            />
            Win by 2
          </label>

          {bracket.type === "DOUBLE_ELIMINATION" && (
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={config.finalsReset ?? false}
                onChange={(event) =>
                  updateConfigField("finalsReset", event.target.checked)
                }
              />
              Finals reset match
            </label>
          )}

          {isRoundRobin && (
            <>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Groups
                <input
                  type="number"
                  min={1}
                  value={config.groups ?? 1}
                  onChange={(event) =>
                    updateConfigField("groups", Number(event.target.value))
                  }
                  className="rounded border px-2 py-1"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Group size
                <input
                  type="number"
                  min={1}
                  value={config.groupSize ?? 1}
                  onChange={(event) =>
                    updateConfigField("groupSize", Number(event.target.value))
                  }
                  className="rounded border px-2 py-1"
                />
              </label>
            </>
          )}
        </div>

        {isElimination && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Rounds</span>
              <button
                type="button"
                onClick={addRound}
                className="text-sm text-blue-600"
              >
                Add round
              </button>
            </div>
            <div className="space-y-2">
              {rounds.map((round, index) => (
                <div
                  key={index}
                  className="grid gap-2 md:grid-cols-[2fr,1fr,auto]"
                >
                  <input
                    type="text"
                    value={round.name}
                    onChange={(event) =>
                      changeRound(index, "name", event.target.value)
                    }
                    className="rounded border px-2 py-1"
                    placeholder="Round name"
                  />
                  <input
                    type="number"
                    min={1}
                    value={round.matchCount}
                    onChange={(event) =>
                      changeRound(index, "matchCount", event.target.value)
                    }
                    className="rounded border px-2 py-1"
                    placeholder="Match count"
                  />
                  <button
                    type="button"
                    onClick={() => removeRound(index)}
                    className="text-sm text-red-500"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {rounds.length === 0 && (
                <p className="text-sm text-gray-500">No rounds defined.</p>
              )}
            </div>
          </section>
        )}

        <footer className="flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            disabled={updateMutation.isLoading}
          >
            {updateMutation.isLoading ? "Saving…" : "Save changes"}
          </button>
        </footer>

        {updateMutation.isError && (
          <p className="text-sm text-red-600">
            Failed to update bracket:{" "}
            {updateMutation.error instanceof Error
              ? updateMutation.error.message
              : "Unknown error"}
          </p>
        )}
      </form>
    </div>
  );
}
