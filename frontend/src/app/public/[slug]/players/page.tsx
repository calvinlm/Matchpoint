import PublicPlayersPage from "./components/PublicPlayersPage";

type PageProps = {
  params: {
    slug: string;
  };
};

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  return <PublicPlayersPage slug={slug} />;
}
