"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";

export default function MarkdownRenderer({ markdown }: { markdown: string }) {
  return (
    <article className="prose prose-zinc max-w-none dark:prose-invert">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          [rehypeSlug],
          [rehypeAutolinkHeadings, { behavior: "wrap" }],
        ]}
      >
        {markdown}
      </ReactMarkdown>
    </article>
  );
}
