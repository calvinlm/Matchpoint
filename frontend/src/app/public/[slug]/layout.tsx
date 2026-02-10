import React from "react";
import PublicTournamentLayout from "./components/PublicTournamentLayout";

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  
  return <PublicTournamentLayout slug={slug}>{children}</PublicTournamentLayout>;
}
