"use client";

import { notFound } from "next/navigation";
// import { useParams } from "next/navigation";
// import ManagePositionContent from "@/components/pool/manage/ManagePositionContent";

export default function ManagePositionPage() {
  notFound();
  // const params = useParams<{ positionId: string }>();
  // const positionId = params?.positionId ?? "";
  //
  // return <ManagePositionContent positionId={positionId} />;
}
