import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { AnomalyDetailFlyoutWrapper } from '@/components/activity/AnomalyDetailFlyoutWrapper';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Alithos Terminal',
  description: 'Professional trading terminal for prediction markets.',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=5',
  icons: {
    icon: 'https://turquoise-keen-koi-739.mypinata.cloud/ipfs/bafkreigacy7alhak3xupjokk6ikxqp455iug66u3ap2olzs4r76gfhuj2e',
    shortcut: 'https://turquoise-keen-koi-739.mypinata.cloud/ipfs/bafkreigacy7alhak3xupjokk6ikxqp455iug66u3ap2olzs4r76gfhuj2e',
    apple: 'https://turquoise-keen-koi-739.mypinata.cloud/ipfs/bafkreigacy7alhak3xupjokk6ikxqp455iug66u3ap2olzs4r76gfhuj2e',
  },
  openGraph: {
    title: 'Alithos Terminal',
    description: 'Professional trading terminal for prediction markets.',
    images: [
      {
        url: 'https://turquoise-keen-koi-739.mypinata.cloud/ipfs/bafkreigdj66ncr5mw5bhfcrnq4xel2ka3cyb7awytbweoa7q7dvq24uhli',
        width: 1200,
        height: 630,
        alt: 'Alithos Terminal',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Alithos Terminal',
    description: 'Professional trading terminal for prediction markets.',
    images: [
      'https://turquoise-keen-koi-739.mypinata.cloud/ipfs/bafkreigdj66ncr5mw5bhfcrnq4xel2ka3cyb7awytbweoa7q7dvq24uhli',
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          {children}
          <AnomalyDetailFlyoutWrapper />
        </Providers>
      </body>
    </html>
  );
}
