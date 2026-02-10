import React from "react";
import TournamentLayout from "./components/TournamentLayout";

export default async function TdTournamentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <TournamentLayout slug={slug}>{children}</TournamentLayout>;
}
