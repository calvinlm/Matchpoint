import DivisionsDirectory from "./components/DivisionsDirectory";

type PageProps = {
  params: {
    slug: string;
  };
};

export default async function Page({ params }: PageProps) {
  // Unwrap params if it's a Promise
  const resolvedParams = await params;

  return <DivisionsDirectory slug={resolvedParams.slug} />;
}
