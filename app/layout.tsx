import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { DemoStateProvider } from '@/components/auth/DemoStateProvider';
import PwaRegister from '@/components/pwa/PwaRegister';
import OfflineNotification from '@/components/pwa/OfflineNotification';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'FusionFit Gym - Management System',
  description: 'Professional gym management for members, health assessments, PAR-Q forms, and invoicing.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FusionFit',
  },
  icons: {
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <AuthProvider>
          <DemoStateProvider>
            {children}
          </DemoStateProvider>
        </AuthProvider>
        <PwaRegister />
        <OfflineNotification />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

