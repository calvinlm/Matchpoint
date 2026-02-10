import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TdProviders } from './providers';

export default function TdLayout({ children }: { children: React.ReactNode }) {
  return (
    <TdProviders>
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/td" className="text-sm font-semibold tracking-tight text-foreground">
              Match Point TD Console
            </Link>
            <div className="hidden text-xs text-muted-foreground sm:block">
              Keyboard shortcuts: Shift+A assign • Shift+R retire • Shift+N advance queue
            </div>
            <Button asChild size="sm" variant="outline" className="sm:hidden">
              <Link href="/td">Home</Link>
            </Button>
          </div>
        </header>
        <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">{children}</main>
      </div>
    </TdProviders>
  );
}
