"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useTournamentSummary } from "@/frontend/hooks/useTournamentSummary";

type Props = {
  slug: string;
  children: React.ReactNode;
};

function NavLink({ href, label, isActive }: { href: string; label: string; isActive: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}

export default function TournamentLayout({ slug, children }: Props) {
  const pathname = usePathname();
  const basePath = `/td/${slug}`;
  const navItems = [
    { label: "Overview", href: basePath },
    { label: "Queue", href: `${basePath}/queue` },
    { label: "Divisions", href: `${basePath}/divisions` },
    { label: "Teams", href: `${basePath}/teams` },
    { label: "Players", href: `${basePath}/players` },
  ];

  const { data, isLoading, isError, error, refetch, isFetching } = useTournamentSummary(slug);

  return (
    <div className="space-y-6">
      <header className="space-y-4 rounded-lg border border-border bg-card/80 p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">TD Console – {slug}</h1>
              <Badge variant="secondary">Slug: {slug}</Badge>
            </div>
            {isLoading ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : data ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {data.name} {data.location ? `• ${data.location}` : ""}
                </p>
                {(data.startDate || data.endDate) && (
                  <p className="text-xs text-muted-foreground">
                    {data.startDate ? new Date(data.startDate).toLocaleDateString() : "TBD"} –{" "}
                    {data.endDate ? new Date(data.endDate).toLocaleDateString() : "TBD"}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{data.totalDivisions} divisions</Badge>
                  <Badge variant="outline">{data.totalBrackets} brackets</Badge>
                  <Badge variant="outline">
                    {data.activeCourts}/{data.totalCourts} courts active
                  </Badge>
                  <Badge variant="outline">{data.activeMatches} active matches</Badge>
                  <Badge variant="secondary">{data.queuedMatches} in queue</Badge>
                </div>
              </>
            ) : (
              <p className="text-sm text-destructive">
                {isError && error instanceof Error ? error.message : "Unable to load tournament info."}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? "Refreshing…" : "Refresh data"}
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href={basePath}>Go to overview</Link>
            </Button>
          </div>
        </div>
        <Separator />
        <nav className="flex flex-wrap gap-2">
          {navItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== basePath && pathname.startsWith(`${item.href}/`));
            return <NavLink key={item.href} href={item.href} label={item.label} isActive={active} />;
          })}
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
