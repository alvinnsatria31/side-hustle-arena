import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Manrope } from 'next/font/google';
import { DemoProvider } from '@/features/demo/store';
import { ToastProvider } from '@/features/ui/toast';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-manrope',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-jetbrains',
});

export const metadata: Metadata = {
  title: {
    default: 'Sekolah Karir — Career Ecosystem',
    template: '%s · Sekolah Karir',
  },
  description:
    'Scan CV, temukan skill gap, kerjakan project dunia nyata, bangun bukti skill, dan temukan peluang kerja yang lebih relevan.',
};

export const viewport: Viewport = {
  themeColor: '#F6F8FC',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${manrope.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen antialiased">
        <DemoProvider>
          <ToastProvider>{children}</ToastProvider>
        </DemoProvider>
      </body>
    </html>
  );
}
