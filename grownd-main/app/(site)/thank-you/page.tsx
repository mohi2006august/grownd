import { ThankYou } from "@/components/ThankYou";
import { getLive } from "@/lib/live";
import { metadataFor } from "@/lib/seo";
import { siteDetails } from "@/lib/view";

export const revalidate = 60;
export const metadata = metadataFor("/thank-you");

export default async function ThankYouPage() {
  return <ThankYou site={siteDetails(await getLive())} />;
}
