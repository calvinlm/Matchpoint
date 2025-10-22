import type { Metadata } from 'next';
import React from 'react';
import './globals.css';
import { cn } from '@/lib/utils';
import { AppProviders } from './providers';

export const metadata: Metadata = {
  title: 'Match Point TD Console',
  description: 'Tournament director tools for Match Point',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={cn('min-h-screen bg-background font-sans antialiased')}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
