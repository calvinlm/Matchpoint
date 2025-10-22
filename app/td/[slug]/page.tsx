import TournamentOverviewPage from "./components/TournamentOverviewPage";

type PageProps = {
  params: {
    slug: string;
  };
};

export default function Page({ params }: PageProps) {
  return <TournamentOverviewPage slug={params.slug} />;
}
