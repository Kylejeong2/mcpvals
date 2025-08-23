import React from "react";
import { listDocs } from "@/lib/docs";
import SidebarClient from "./SidebarClient";

export default function Sidebar() {
  const docs = listDocs();
  return <SidebarClient docs={docs} />;
}
