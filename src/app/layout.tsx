import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from '@clerk/themes'
import { ptBR } from '@clerk/localizations'
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Plus_Jakarta_Sans({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});


export const metadata: Metadata = {
  title: "Ingressify Admin",
  description: "Painel administrativo da plataforma Ingressify",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} antialiased`}
      >
        <ConvexClientProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
          >
            <ClerkProvider localization={ptBR} appearance={{
              baseTheme: dark,
            }}>
              {children}
              <Toaster />
            </ClerkProvider>
          </ThemeProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
