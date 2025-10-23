import PublicStandingsPage from "./components/PublicStandingsPage";

type PageProps = {
  params: {
    slug: string;
  };
};

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  return <PublicStandingsPage slug={slug} />;
}
