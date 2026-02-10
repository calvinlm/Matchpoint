'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from './AuthContext';

const LOGIN_ROUTE = '/login';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!token) {
      router.replace(`${LOGIN_ROUTE}?next=${encodeURIComponent(pathname || '/td')}`);
    }
  }, [isLoading, token, router, pathname]);

  if (isLoading) {
    return <div className="p-6 text-sm text-gray-500">Checking authentication…</div>;
  }

  if (!token) {
    return null;
  }

  return <>{children}</>;
}
