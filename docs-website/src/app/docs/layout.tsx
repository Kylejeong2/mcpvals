import SiteLayout from "../(site)/layout";
import React from "react";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SiteLayout>{children}</SiteLayout>;
}
