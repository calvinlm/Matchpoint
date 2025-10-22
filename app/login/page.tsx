"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/frontend/auth/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, token, isLoading } = useAuth();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!isLoading && token) {
      const next = searchParams?.get("next");
      if (next) {
        router.replace(next);
      } else if (slug) {
        router.replace(`/td/${slug}`);
      } else {
        router.replace("/td");
      }
    }
  }, [token, isLoading, router, searchParams, slug]);

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();

    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await login(email, password);
      const next = searchParams?.get("next");
      if (next) {
        router.replace(next);
      } else if (slug.trim()) {
        router.replace(`/td/${slug.trim()}`);
      } else {
        router.replace("/td");
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-2 text-center">
          <CardTitle>Match Point TD Login</CardTitle>
          <CardDescription>Sign in with your credentials to manage tournament operations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2 text-left">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="director@example.com"
                required
              />
            </div>

            <div className="space-y-2 text-left">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <div className="space-y-2 text-left">
              <Label htmlFor="slug">Tournament slug (optional)</Label>
              <Input
                id="slug"
                type="text"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder="e.g. my-tournament-2025"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground">
            Having trouble? Verify your email/password in the TD console or reset your credentials with the administrator.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
