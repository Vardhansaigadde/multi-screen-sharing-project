import { Suspense } from "react";
import HostDashboard from "@/components/HostDashboard";

export default function HostPage(props: PageProps<"/host/[code]">) {
  return (
    <Suspense>
      <HostPageContent {...props} />
    </Suspense>
  );
}

async function HostPageContent({ params, searchParams }: PageProps<"/host/[code]">) {
  const { code } = await params;
  const { key } = await searchParams;
  return <HostDashboard code={code.toUpperCase()} hostKey={typeof key === "string" ? key : ""} />;
}
