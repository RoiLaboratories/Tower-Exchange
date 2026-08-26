"use client";

import { notFound } from "next/navigation";
// import { useEffect, useMemo } from "react";
// import { useParams, useRouter } from "next/navigation";
// import PoolDetailContent from "@/components/pool/detail/PoolDetailContent";
// import { getPoolDetail } from "@/lib/pool/data";

export default function PoolDetailPage() {
  notFound();
  // const params = useParams<{ poolId: string }>();
  // const router = useRouter();
  // const poolId = params?.poolId ?? "";
  //
  // const pool = useMemo(() => getPoolDetail(poolId), [poolId]);
  //
  // useEffect(() => {
  //   if (!pool) {
  //     router.replace("/pool/explore");
  //   }
  // }, [pool, router]);
  //
  // if (!pool) {
  //   return (
  //     <main className="mx-auto flex min-h-[240px] items-center justify-center px-4 py-6">
  //       <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
  //     </main>
  //   );
  // }
  //
  // return <PoolDetailContent pool={pool} />;
}
