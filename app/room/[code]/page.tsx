import { Suspense } from "react";
import ParticipantView from "@/components/ParticipantView";

export default function RoomPage(props: PageProps<"/room/[code]">) {
  return (
    <Suspense>
      <RoomPageContent {...props} />
    </Suspense>
  );
}

async function RoomPageContent({ params, searchParams }: PageProps<"/room/[code]">) {
  const { code } = await params;
  const { name } = await searchParams;
  return (
    <ParticipantView
      code={code.toUpperCase()}
      initialName={typeof name === "string" ? name : ""}
    />
  );
}
