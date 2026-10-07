import { JsonLd } from "@/components/JsonLd";
import { PolicyPage } from "@/components/PolicyPage";
import { getLive } from "@/lib/live";
import { TERMS } from "@/lib/policies";
import { metadataFor, pageSeo, structuredData } from "@/lib/seo";
import { siteDetails } from "@/lib/view";

export const revalidate = 60;
export const metadata = metadataFor("/terms");

export default async function TermsPage() {
  const live = await getLive();
  const s = siteDetails(live);
  return (
    <>
      <JsonLd data={structuredData(pageSeo("/terms"))} />
      <PolicyPage policy={TERMS} values={{ business: s.businessName, email: s.email, phone: s.phone, address: s.address, responseTime: s.responseTime, holdMinutes: live?.payments.holdMinutes ?? 30 }} />
    </>
  );
}
