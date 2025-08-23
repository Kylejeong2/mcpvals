import type { Metadata } from "next";
import React from "react";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MCPVals - MCP Server Testing Framework",
  description:
    "A powerful testing and evaluation framework for Model Context Protocol (MCP) servers. Build reliable, well-tested MCP integrations with ease.",
  keywords:
    "MCP, Model Context Protocol, testing, evaluation, framework, TypeScript",
  authors: [{ name: "Kyle Jeong" }],
  openGraph: {
    title: "MCPVals - MCP Server Testing Framework",
    description: "Test your MCP servers with confidence",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.className}>
      <body className="min-h-screen bg-white text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
        {children}
      </body>
    </html>
  );
}
