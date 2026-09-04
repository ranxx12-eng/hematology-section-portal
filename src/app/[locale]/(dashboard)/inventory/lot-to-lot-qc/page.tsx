import { redirect } from 'next/navigation';

export default async function LegacyLotToLotQcRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/inventory/qc-lot-verification`);
}
