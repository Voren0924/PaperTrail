import { PaperDetailPage } from "@/components/PaperDetailPage";

type PaperPageProps = {
  params: Promise<{
    paperId: string;
  }>;
};

export default async function PaperPage({ params }: PaperPageProps) {
  const { paperId } = await params;

  return <PaperDetailPage paperId={paperId} />;
}
