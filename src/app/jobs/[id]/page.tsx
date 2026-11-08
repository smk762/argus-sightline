import { Workspace } from "@/components/workspace/Workspace";

export default async function JobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ demo?: string }>;
}) {
  const { id } = await params;
  const { demo } = await searchParams;
  return <Workspace jobId={decodeURIComponent(id)} demo={demo === "1"} />;
}
