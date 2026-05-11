import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'FCON Performance Tracker',
  description: 'Theo dõi phong độ cầu thủ theo dữ liệu trận đấu thực tế.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}