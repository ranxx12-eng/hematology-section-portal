import { redirect } from 'next/navigation';

export default async function LegacyLotToLotQcDetailRedirect({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  redirect(`/${locale}/inventory/qc-lot-verification/cbc/${id}`);
}
