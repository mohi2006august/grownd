import { JsonLd } from "@/components/JsonLd";
import { Quiz } from "@/components/Quiz";
import { metadataFor, pageSeo, structuredData } from "@/lib/seo";

export const metadata = metadataFor("/quiz");

export default function QuizPage() {
  return (
    <>
      <JsonLd data={structuredData(pageSeo("/quiz"))} />
      <Quiz />
    </>
  );
}
