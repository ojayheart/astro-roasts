import type { Metadata } from "next";
import { db } from "@/lib/db";
import { roasts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import RoastClient from "./RoastClient";
import { buildRoastPayload, getRoastUser } from "@/lib/roast-response";

interface Props {
  params: Promise<{ id: string }>;
}

// Shared-link cards: subject's name + the roast's one-line title (never the
// roast body — spoiler-free). opengraph-image.tsx renders the matching card.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const roast = await db.query.roasts.findFirst({
    where: eq(roasts.id, id),
    with: { user: true, subjects: { with: { user: true } } },
  });
  if (!roast || roast.status !== "ready") {
    return { title: "Astro Roasts | Case file" };
  }

  const subjectNames =
    roast.subjects && roast.subjects.length
      ? [...roast.subjects]
          .sort((a, b) => a.position - b.position)
          .map((s) => s.user.name)
      : [getRoastUser(roast).name];
  const name = subjectNames.join(" & ");
  const title = `${name} — the case file | Astro Roasts`;
  const description =
    roast.title ||
    `Sun ${roast.sunSign}, Moon ${roast.moonSign}, ${roast.rising} rising. The chart has been read.`;

  return {
    title,
    description,
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function RoastPage({ params }: Props) {
  const { id } = await params;

  const roast = await db.query.roasts.findFirst({
    where: eq(roasts.id, id),
    with: { user: true, subjects: { with: { user: true } } },
  });

  if (!roast) {
    notFound();
  }

  return <RoastClient roastId={id} initialData={buildRoastPayload(roast)} />;
}
