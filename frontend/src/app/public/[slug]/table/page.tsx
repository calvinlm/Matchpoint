import PublicQueuePage from "./components/PublicQueuePage";

type PageProps = {
  params: {
    slug: string;
  };
};

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  return <PublicQueuePage slug={slug} />;
}
