import PublicBracketsPage from "./components/PublicBracketsPage";

type PageProps = {
  params: {
    slug: string;
  };
};

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  return <PublicBracketsPage slug={slug} />;
}
