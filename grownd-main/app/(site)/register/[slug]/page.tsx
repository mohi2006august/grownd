import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { RegisterForm } from "@/components/RegisterForm";
import { getLive } from "@/lib/live";
import { MISSIONS, missionBySlug } from "@/lib/missions";
import { metadataFor, pageSeo, structuredData } from "@/lib/seo";
import { missionView, siteDetails } from "@/lib/view";

export const revalidate = 60;
export const dynamicParams = false;

export function generateStaticParams() {
  return MISSIONS.map(m => ({ slug: m.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return metadataFor(`/register/${(await params).slug}`);
}

export default async function RegisterMissionPage({ params }: Props) {
  const { slug } = await params;
  const mission = missionBySlug(slug);
  if (!mission) notFound();
  const live = await getLive();
  return (
    <>
      <JsonLd data={structuredData(pageSeo(`/register/${slug}`))} />
      <RegisterForm mission={missionView(mission, live, MISSIONS.indexOf(mission))} site={siteDetails(live)} />
    </>
  );
}
