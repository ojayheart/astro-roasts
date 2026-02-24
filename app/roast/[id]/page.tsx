import { getRoast } from "@/lib/kv";
import { notFound } from "next/navigation";
import RoastClient from "./RoastClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RoastPage({ params }: Props) {
  const { id } = await params;
  const roast = await getRoast(id);

  if (!roast) {
    notFound();
  }

  return <RoastClient roastId={id} initialData={roast} />;
}
