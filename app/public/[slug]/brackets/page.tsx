import PublicBracketsPage from "./components/PublicBracketsPage";

type PageProps = {
  params: {
    slug: string;
  };
};

export default function Page({ params }: PageProps) {
  return <PublicBracketsPage slug={params.slug} />;
}
