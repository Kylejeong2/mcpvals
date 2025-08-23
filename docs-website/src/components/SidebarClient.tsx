"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Doc } from "@/lib/docs";

export default function SidebarClient({ docs }: { docs: Doc[] }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { title: "Getting Started", items: [] as typeof docs },
    { title: "Usage", items: [] as typeof docs },
    { title: "Reference", items: [] as typeof docs },
    { title: "More", items: [] as typeof docs },
  ];

  // Categorize docs
  docs.forEach((doc) => {
    const slug = doc.slug[0];
    if (slug === "index" || slug === "quick-start" || slug === "installation") {
      navItems[0].items.push(doc);
    } else if (
      slug === "cli" ||
      slug === "configuration" ||
      slug === "vitest"
    ) {
      navItems[1].items.push(doc);
    } else if (slug === "library-api" || slug === "evaluation") {
      navItems[2].items.push(doc);
    } else {
      navItems[3].items.push(doc);
    }
  });

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-lg lg:hidden"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {isOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      {/* Sidebar */}
      <aside
        className={`${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } fixed lg:sticky top-0 left-0 z-40 h-screen w-64 shrink-0 overflow-y-auto border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 transition-transform duration-200`}
      >
        <div className="p-6">
          {/* Logo */}
          <div className="flex items-center space-x-2 mb-8">
            <span className="text-lg font-semibold text-zinc-900 dark:text-white">
              MCPVals Docs
            </span>
          </div>

          {/* Navigation */}
          <nav className="space-y-6">
            {navItems.map(
              (section, idx) =>
                section.items.length > 0 && (
                  <div key={idx}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      {section.title}
                    </h3>
                    <div className="space-y-1">
                      {section.items.map((doc) => {
                        const href = `/docs/${doc.slug.join("/")}`;
                        const isActive = pathname === href;
                        return (
                          <Link
                            key={doc.filePath}
                            href={href}
                            className={`block rounded px-3 py-1.5 text-sm transition-colors ${
                              isActive
                                ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-medium"
                                : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white"
                            }`}
                          >
                            {doc.title}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ),
            )}
          </nav>

          {/* Footer Links */}
          <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center space-x-4 text-sm">
              <a
                href="https://github.com/kylejeong/mcpvals"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
              >
                GitHub
              </a>
              <a
                href="https://npmjs.com/package/mcpvals"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
              >
                npm
              </a>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
