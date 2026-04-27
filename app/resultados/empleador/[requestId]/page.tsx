import { AppHeader } from "@/components/app-header";
import { OutcomeAnswer } from "@/components/outcome-answer";

export default function EmployerOutcomePage({
  params
}: {
  params: { requestId: string };
}) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <OutcomeAnswer audience="employer" requestId={params.requestId} />
      </main>
    </>
  );
}
