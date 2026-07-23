import { notFound } from 'next/navigation';
import PublicInvoiceView from '@/components/invoice/PublicInvoiceView';
import { getPublicInvoiceByToken } from '@/lib/actions/public-invoice';

export const metadata = {
  title: 'Invoice | FusionFit Gym',
  description: 'View your FusionFit Gym membership invoice',
};

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getPublicInvoiceByToken(token);

  if (!data) notFound();

  return <PublicInvoiceView invoice={data.invoice} settings={data.settings} />;
}
