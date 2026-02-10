import DivisionWorkspace from "./components/DivisionWorkspace";

type PageProps = {
  params: {
    slug: string;
    divisionId: string;
  };
};

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const { divisionId } = await params;
  return <DivisionWorkspace slug={slug} divisionId={divisionId} />;
}
