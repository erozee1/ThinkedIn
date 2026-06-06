import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "thinkedin — talk to your network in one prompt",
  description:
    "Import your LinkedIn network and chat with it. Ask in plain English and thinkedin finds the right people.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <ClerkProvider
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInForceRedirectUrl="/dashboard"
          signUpForceRedirectUrl="/dashboard"
          signInFallbackRedirectUrl="/dashboard"
          signUpFallbackRedirectUrl="/dashboard"
          afterSignOutUrl="/"
        >
          {children}
          <Analytics />
        </ClerkProvider>
      </body>
    </html>
  );
}
