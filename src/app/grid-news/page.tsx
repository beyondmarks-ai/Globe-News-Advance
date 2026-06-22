import GridNewsView from "@/components/GridNewsView";

type GridNewsPageProps = {
  searchParams: Promise<{ date?: string; time?: string }>;
};

export default async function GridNewsPage({ searchParams }: GridNewsPageProps) {
  const params = await searchParams;

  return <GridNewsView initialDate={params.date} initialTime={params.time} />;
}
