import PublicQueuePage from "./components/PublicQueuePage";

type PageProps = {
  params: {
    slug: string;
  };
};

export default function Page({ params }: PageProps) {
  return <PublicQueuePage slug={params.slug} />;
}
