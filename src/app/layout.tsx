// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { NextAuthProvider } from "./providers";
import { ThemeProvider } from '@/contexts/ThemeContext'; // Adjust path


const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "SpotiMap", // You can change this
    description: "Visualize your Spotify listening habits on a map!", // And this
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body className={inter.className}> {/* Ensure inter.className or your font is applied */}
                <ThemeProvider> {/* Wrap NextAuthProvider or children */}
                    <NextAuthProvider>{children}</NextAuthProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}