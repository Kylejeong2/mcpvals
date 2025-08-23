import MarkdownRenderer from '@/components/MarkdownRenderer'
import { getDocBySlug, listDocs } from '@/lib/docs'
import { notFound } from 'next/navigation'
export async function generateStaticParams() { return listDocs().map((d) => ({ slug: d.slug })) }
export default function DocPage({ params }: { params: { slug?: string[] } }) {
  const doc = getDocBySlug(params.slug)
  if (!doc) return notFound()
  return <MarkdownRenderer markdown={doc.content} />
}