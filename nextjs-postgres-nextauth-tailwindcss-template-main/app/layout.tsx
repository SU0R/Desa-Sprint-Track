import './globals.css';

import { Analytics } from '@vercel/analytics/react';
import { Barlow_Condensed, Inter } from 'next/font/google';

import { IntroSplash } from '@/components/intro-splash';

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
  title: 'DESA Sprint Console',
  description: 'A polished sprint timer and finish-line camera console.'
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
        <IntroSplash />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
