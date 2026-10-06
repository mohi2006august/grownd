import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { RegisterForm } from "@/components/RegisterForm";
import { getLive } from "@/lib/live";
import { MISSIONS } from "@/lib/missions";
import { metadataFor, pageSeo, structuredData } from "@/lib/seo";
import { siteDetails } from "@/lib/view";

export const revalidate = 60;
export const metadata: Metadata = metadataFor("/register");

export default async function RegisterPage() {
  const live = await getLive();
  return (
    <>
      <JsonLd data={structuredData(pageSeo("/register"))} />
      <RegisterForm mission={null} site={siteDetails(live)} />
    </>
  );
}
