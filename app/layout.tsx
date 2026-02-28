import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Roo Office',
  description: 'Remote command center for OpenClaw AI agent token analytics.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} bg-bg text-text antialiased`}>{children}</body>
    </html>
  );
}
