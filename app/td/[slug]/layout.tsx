import React from "react";
import TournamentLayout from "./components/TournamentLayout";

export default function TdTournamentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  return <TournamentLayout slug={params.slug}>{children}</TournamentLayout>;
}
