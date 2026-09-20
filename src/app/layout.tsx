import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: "Nomi",
  applicationName: "Nomi",
  authors: [{ name: "Llama Inc." }],
  description:
    "Plans your trips, knows what is worth doing, books it, and stays on call while you travel.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/app"
          signUpFallbackRedirectUrl="/app"
          appearance={{
            // Clerk's components follow the page theme through the same
            // tokens the rest of the app uses (see globals.css).
            variables: {
              colorPrimary: "var(--accent)",
              colorPrimaryForeground: "var(--accent-fg)",
              colorBackground: "var(--surface)",
              colorForeground: "var(--fg)",
              colorMutedForeground: "var(--muted)",
              colorInput: "var(--bg)",
              colorInputForeground: "var(--fg)",
              colorBorder: "var(--border)",
              colorNeutral: "var(--fg)",
              borderRadius: "0.875rem",
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            },
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
