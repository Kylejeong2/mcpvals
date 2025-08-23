import React from "react";
import Sidebar from "@/components/Sidebar";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-white dark:bg-zinc-950">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl px-8 py-12">{children}</div>
      </main>
    </div>
  );
}
