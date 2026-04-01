import './globals.css';

import { Analytics } from '@vercel/analytics/react';
import { Barlow_Condensed, Inter } from 'next/font/google';

const headingFont = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-heading'
});

const bodyFont = Inter({
  subsets: ['latin'],
  variable: '--font-body'
});

export const metadata = {
  title: 'Sprint Tracker',
  description:
    'A local-first sprint tracking dashboard for sessions, attempts, charts, timer prototypes, and room scaffolding.'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${headingFont.variable} ${bodyFont.variable} flex min-h-screen w-full flex-col bg-background font-sans text-foreground antialiased`}
      >
        {children}
      </body>
      <Analytics />
    </html>
  );
}
