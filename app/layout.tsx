import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/layout/Sidebar';

export const metadata: Metadata = {
  title: 'FusionFit Gym — Management System',
  description: 'Professional gym management system for member registration, health assessments, PAR-Q forms, and invoicing.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Bebas+Neue&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="flex min-h-screen bg-[#f8f8f8]">
          <Sidebar />
          <main
            className="flex-1 min-h-screen"
            style={{ marginLeft: 'var(--sidebar-width)' }}
          >
            {/* Mobile top padding for hamburger */}
            <div className="lg:hidden h-16" />
            <div className="p-6 lg:p-8">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
