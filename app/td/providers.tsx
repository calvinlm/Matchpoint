'use client';

import React from 'react';
import { AuthGuard } from '@/frontend/auth/AuthGuard';

export function TdProviders({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
