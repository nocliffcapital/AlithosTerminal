import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Alithos Terminal - Polymarket Terminal',
  description: 'Professional trading terminal for Polymarket prediction markets',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=5',
  icons: {
    icon: 'https://turquoise-keen-koi-739.mypinata.cloud/ipfs/bafkreigacy7alhak3xupjokk6ikxqp455iug66u3ap2olzs4r76gfhuj2e',
    shortcut: 'https://turquoise-keen-koi-739.mypinata.cloud/ipfs/bafkreigacy7alhak3xupjokk6ikxqp455iug66u3ap2olzs4r76gfhuj2e',
    apple: 'https://turquoise-keen-koi-739.mypinata.cloud/ipfs/bafkreigacy7alhak3xupjokk6ikxqp455iug66u3ap2olzs4r76gfhuj2e',
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
