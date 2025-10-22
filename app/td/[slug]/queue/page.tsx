import React from 'react';
import { TournamentQueuePanel } from './components/TournamentQueuePanel';

interface PageProps {
  params: {
    slug: string;
  };
}

export default function QueuePage({ params }: PageProps) {
  return <TournamentQueuePanel slug={params.slug} />;
}
