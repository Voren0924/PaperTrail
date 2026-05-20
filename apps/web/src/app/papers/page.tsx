import { AuthGate } from "@/components/AuthGate";
import { PaperListPage } from "@/components/PaperListPage";

export default function PapersPage() {
  return (
    <AuthGate>
      <PaperListPage />
    </AuthGate>
  );
}
