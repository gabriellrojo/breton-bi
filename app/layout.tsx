import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Breton Intelligence | Analytics', description: 'Business intelligence de navegação e produtos da Breton' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="pt-BR"><body>{children}</body></html>; }
