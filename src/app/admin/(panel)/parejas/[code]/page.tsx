import { CoupleScreen } from "@/components/admin/screens";

export default async function CouplePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <CoupleScreen code={code} />;
}
