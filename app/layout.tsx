import type { ReactNode } from 'react';
import { Roboto } from 'next/font/google';
import './globals.css';

const roboto = Roboto({ subsets: ['latin', 'vietnamese'], variable: '--font-roboto', display: 'swap' });

export const metadata = {
  title: 'FCON Performance Tracker',
  description: 'Theo dõi phong độ cầu thủ theo dữ liệu trận đấu thực tế.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body className={roboto.variable}>{children}</body>
    </html>
  );
}
