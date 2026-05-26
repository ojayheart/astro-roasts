import { db } from "@/lib/db";
import { roasts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import RoastClient from "./RoastClient";
import { buildRoastPayload } from "@/lib/roast-response";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RoastPage({ params }: Props) {
  const { id } = await params;

  const roast = await db.query.roasts.findFirst({
    where: eq(roasts.id, id),
    with: { user: true },
  });

  if (!roast) {
    notFound();
  }

  return (
    <RoastClient
      roastId={id}
      initialData={buildRoastPayload(roast)}
    />
  );
}
