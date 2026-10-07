import { JsonLd } from "@/components/JsonLd";
import { PolicyPage } from "@/components/PolicyPage";
import { getLive } from "@/lib/live";
import { REFUNDS } from "@/lib/policies";
import { metadataFor, pageSeo, structuredData } from "@/lib/seo";
import { siteDetails } from "@/lib/view";

export const revalidate = 60;
export const metadata = metadataFor("/refunds");

export default async function RefundsPage() {
  const live = await getLive();
  const s = siteDetails(live);
  return (
    <>
      <JsonLd data={structuredData(pageSeo("/refunds"))} />
      <PolicyPage policy={REFUNDS} values={{ business: s.businessName, email: s.email, phone: s.phone, address: s.address, responseTime: s.responseTime, holdMinutes: live?.payments.holdMinutes ?? 30 }} />
    </>
  );
}
