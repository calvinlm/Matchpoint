import DivisionsDirectory from "./components/DivisionsDirectory";

type PageProps = {
  params: {
    slug: string;
  };
};

export default function Page({ params }: PageProps) {
  return <DivisionsDirectory slug={params.slug} />;
}
