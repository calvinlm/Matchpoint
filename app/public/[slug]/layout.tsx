import React from "react";
import PublicTournamentLayout from "./components/PublicTournamentLayout";

export default function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  return <PublicTournamentLayout slug={params.slug}>{children}</PublicTournamentLayout>;
}
