import MatchPrintPage from "./components/MatchPrintPage";

type PageProps = {
  params: {
    slug: string;
    matchId: string;
  };
};

export default function Page({ params }: PageProps) {
  return <MatchPrintPage slug={params.slug} matchId={params.matchId} />;
}
