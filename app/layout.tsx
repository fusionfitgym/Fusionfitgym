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
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="grid min-h-screen w-full transition-all duration-300 grid-cols-1 md:grid-cols-[80px_1fr] lg:grid-cols-[260px_1fr]" style={{ background: 'var(--bg-page)' }}>
          <Sidebar />
          <main className="flex flex-col min-w-0 min-h-screen overflow-x-hidden">
            {/* Mobile top spacer for hamburger */}
            <div className="md:hidden h-16 w-full flex-shrink-0" />
            <div className="flex-1 w-full mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
