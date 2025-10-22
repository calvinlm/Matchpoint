import PublicPlayersPage from "./components/PublicPlayersPage";

type PageProps = {
  params: {
    slug: string;
  };
};

export default function Page({ params }: PageProps) {
  return <PublicPlayersPage slug={params.slug} />;
}
