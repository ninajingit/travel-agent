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
  title: "Passage",
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
            // Clerk's components take real colour values, so they render in
            // the dark palette in both modes.
            variables: {
              colorPrimary: "#c6ff3d",
              colorBackground: "#15151b",
              colorForeground: "#f5f5f7",
              colorInput: "#0b0b0f",
              colorInputForeground: "#f5f5f7",
              colorBorder: "#2a2a36",
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
