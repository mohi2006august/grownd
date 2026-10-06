import { Suspense } from "react";
import { JsonLd } from "@/components/JsonLd";
import { MissionsBrowser, MissionsList } from "@/components/MissionsBrowser";
import { getLive } from "@/lib/live";
import { MISSIONS } from "@/lib/missions";
import { metadataFor, pageSeo, structuredData } from "@/lib/seo";
import { cityMap, missionView } from "@/lib/view";

export const revalidate = 60;
export const metadata = metadataFor("/missions");

export default async function MissionsPage() {
  const live = await getLive();
  const all = MISSIONS.map((m, i) => missionView(m, live, i));
  const cities = cityMap(live);
  return (
    <>
      <JsonLd data={structuredData(pageSeo("/missions"))} />
      <Suspense fallback={<MissionsList all={all} cities={cities} cat="" city="" />}>
        <MissionsBrowser all={all} cities={cities} />
      </Suspense>
    </>
  );
}
