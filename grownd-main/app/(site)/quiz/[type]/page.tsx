import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { ResultView } from "@/components/ResultView";
import { getLive } from "@/lib/live";
import { MISSIONS, TYPES, TYPE_ORDER, missionById, typeBySlug } from "@/lib/missions";
import { metadataFor, pageSeo, structuredData } from "@/lib/seo";
import { missionView } from "@/lib/view";

export const revalidate = 60;
export const dynamicParams = false;

export function generateStaticParams() {
  return TYPE_ORDER.map(k => ({ type: TYPES[k].slug }));
}

type Props = { params: Promise<{ type: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return metadataFor(`/quiz/${(await params).type}`);
}

export default async function ResultPage({ params }: Props) {
  const { type } = await params;
  const key = typeBySlug(type);
  if (!key) notFound();
  const live = await getLive();
  const view = (id: string) => missionView(missionById(id)!, live, MISSIONS.findIndex(m => m.id === id));
  return (
    <>
      <JsonLd data={structuredData(pageSeo(`/quiz/${type}`))} />
      <ResultView typeKey={key} primary={view(TYPES[key].recs[0])} second={view(TYPES[key].recs[1])} />
    </>
  );
}
