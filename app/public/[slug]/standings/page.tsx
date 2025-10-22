import PublicStandingsPage from "./components/PublicStandingsPage";

type PageProps = {
  params: {
    slug: string;
  };
};

export default function Page({ params }: PageProps) {
  return <PublicStandingsPage slug={params.slug} />;
}
