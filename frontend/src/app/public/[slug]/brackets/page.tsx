import PublicBracketsPage from "./components/PublicBracketsPage";

type PageProps = {
  params: {
    slug: string;
  };
};

export default async function Page({ params }: PageProps) {
  // Unwrap params Promise
  const resolvedParams = await params;
  const { slug } = resolvedParams;

  // Render PublicBracketsPage
  return <PublicBracketsPage slug={slug} />;
}
