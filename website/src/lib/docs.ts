import fs from 'node:fs'
import path from 'node:path'
export type Doc = { slug: string[]; title: string; filePath: string }
const CONTENT_DIR = path.join(process.cwd(), 'content')
export function listDocs(): Doc[] {
  if (!fs.existsSync(CONTENT_DIR)) return []
  const entries = fs.readdirSync(CONTENT_DIR, { withFileTypes: true })
  const docs: Doc[] = []
  for (const e of entries) {
    if (e.isFile() && e.name.endsWith('.md')) {
      const filePath = path.join(CONTENT_DIR, e.name)
      const raw = fs.readFileSync(filePath, 'utf8')
      const title = (raw.match(/^#\s+(.+)$/m)?.[1] ?? e.name.replace(/\.md$/, '')).trim()
      const slug = [e.name.replace(/\.md$/, '')]
      docs.push({ slug, title, filePath })
    }
  }
  return docs.sort((a, b) => (a.slug[0] === 'index' ? -1 : b.slug[0] === 'index' ? 1 : a.title.localeCompare(b.title)))
}
export function getDocBySlug(slugParts: string[] | undefined): { title: string; content: string } | null {
  const slug = (slugParts && slugParts.length > 0 ? slugParts : ['index']).join('/')
  const filePath = path.join(CONTENT_DIR, slug + '.md')
  if (!fs.existsSync(filePath)) return null
  const raw = fs.readFileSync(filePath, 'utf8')
  const title = (raw.match(/^#\s+(.+)$/m)?.[1] ?? slugParts?.[slugParts.length - 1] ?? 'Document').trim()
  return { title, content: raw }
}