"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type Props = {
  slug: string;
  children: React.ReactNode;
};

const NAV_ITEMS = [
  { label: "Players", path: "players" },
  { label: "Standings", path: "standings" },
  { label: "Queue", path: "table" },
  { label: "Brackets", path: "brackets" },
];

export default function PublicTournamentLayout({ slug, children }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const kiosk = searchParams.get("kiosk");
  const kioskSuffix = kiosk ? `?kiosk=${kiosk}` : "";

  return (
    <div className="space-y-6">
      <header className="rounded-lg border border-border bg-card/70 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Tournament</p>
            <h1 className="text-2xl font-semibold text-foreground">{slug}</h1>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={`/td/${slug}`}>TD Console</Link>
          </Button>
        </div>
        <Separator className="my-4" />
        <nav className="flex flex-wrap gap-2">
          {NAV_ITEMS.map((item) => {
            const href = `/public/${slug}/${item.path}${kioskSuffix}`;
            const active = pathname.startsWith(`/public/${slug}/${item.path}`);
            return (
              <Link
                key={item.path}
                href={href}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
