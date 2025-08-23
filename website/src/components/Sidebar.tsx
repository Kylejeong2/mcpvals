import Link from 'next/link'
import { listDocs } from '@/lib/docs'
export default function Sidebar() {
  const docs = listDocs()
  return (
    <aside className="w-64 shrink-0 border-r border-zinc-200/60 dark:border-zinc-800/60 p-4 sticky top-0 h-screen overflow-y-auto">
      <div className="text-lg font-semibold mb-4">MCPVals Docs</div>
      <nav className="space-y-1">
        {docs.map((d) => (
          <Link key={d.filePath} href={`/docs/${d.slug.join('/')}`} className="block rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-900">{d.title}</Link>
        ))}
      </nav>
    </aside>
  )
}