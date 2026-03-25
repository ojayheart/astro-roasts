import { db } from "@/lib/db";
import { roasts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import RoastClient from "./RoastClient";

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

  const user = Array.isArray(roast.user) ? roast.user[0] : roast.user;

  return (
    <RoastClient
      roastId={id}
      initialData={{
        id: roast.id,
        name: user.name,
        status:
          (roast.status as "generating" | "ready" | "error") || "generating",
        sunSign: roast.sunSign || "",
        moonSign: roast.moonSign || "",
        rising: roast.rising || "",
        mercurySign: roast.mercurySign || "",
        venusSign: roast.venusSign || "",
        marsSign: roast.marsSign || "",
        jupiterSign: roast.jupiterSign || "",
        saturnSign: roast.saturnSign || "",
        teaser: roast.teaser || "",
        fullText: roast.fullText || "",
        callouts: roast.callouts ? roast.callouts.split("|") : [],
        paid: roast.paid,
        createdAt: roast.createdAt.toISOString(),
      }}
    />
  );
}
