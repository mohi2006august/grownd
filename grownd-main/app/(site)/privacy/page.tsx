import { JsonLd } from "@/components/JsonLd";
import { PolicyPage } from "@/components/PolicyPage";
import { getLive } from "@/lib/live";
import { PRIVACY } from "@/lib/policies";
import { metadataFor, pageSeo, structuredData } from "@/lib/seo";
import { siteDetails } from "@/lib/view";

export const revalidate = 60;
export const metadata = metadataFor("/privacy");

export default async function PrivacyPage() {
  const live = await getLive();
  const s = siteDetails(live);
  return (
    <>
      <JsonLd data={structuredData(pageSeo("/privacy"))} />
      <PolicyPage policy={PRIVACY} values={{ business: s.businessName, email: s.email, phone: s.phone, address: s.address, responseTime: s.responseTime, holdMinutes: live?.payments.holdMinutes ?? 30 }} />
    </>
  );
}
