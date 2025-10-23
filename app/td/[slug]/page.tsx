import TournamentOverviewPage from "./components/TournamentOverviewPage";

type PageProps = {
  params: {
    slug: string;
  };
};

export default async function Page({ params }: PageProps) {
  const { slug } = params;
  return <TournamentOverviewPage slug={slug} />;
}
