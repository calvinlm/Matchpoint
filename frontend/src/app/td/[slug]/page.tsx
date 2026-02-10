import TournamentOverviewPage from "./components/TournamentOverviewPage";

type PageProps = {
  params: {
    slug: string;
  };
};

export default async function Page({ params }: PageProps) {
  // Unwrap params if it's a Promise
  const resolvedParams = await params;
  const { slug } = resolvedParams;

  return <TournamentOverviewPage slug={slug} />;
}
