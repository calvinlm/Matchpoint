import DivisionWorkspace from "./components/DivisionWorkspace";

type PageProps = {
  params: {
    slug: string;
    divisionId: string;
  };
};

export default function Page({ params }: PageProps) {
  return <DivisionWorkspace slug={params.slug} divisionId={params.divisionId} />;
}
