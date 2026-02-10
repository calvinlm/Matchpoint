import React from 'react';
import { TournamentQueuePanel } from './components/TournamentQueuePanel';

interface PageProps {
  params: {
    slug: string;
  };
}

export default async function QueuePage({ params }: PageProps) {
  // Unwrap params if it's a Promise
  const resolvedParams = await params;
  const { slug } = resolvedParams;

  return <TournamentQueuePanel slug={slug} />;
}
