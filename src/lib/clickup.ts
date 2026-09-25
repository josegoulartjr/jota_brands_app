import { supabase } from '@/lib/supabase'
import type { PackItem } from '@/types/database'

let cachedToken: string | null | undefined

async function getClickUpToken(): Promise<string | null> {
  if (cachedToken !== undefined) return cachedToken
  const { data } = await supabase.from('settings').select('clickup_token').limit(1).single()
  const token: string | null = data?.clickup_token || null
  cachedToken = token
  return token
}

// Busca o título do card no ClickUp a partir do link. Retorna null se não
// houver token configurado ou se o link não for de um card válido.
export async function fetchClickUpTitle(url: string): Promise<string | null> {
  const token = await getClickUpToken()
  if (!token) return null
  try {
    const res = await fetch(`/api/clickup?action=task&token=${encodeURIComponent(token)}&url=${encodeURIComponent(url)}`)
    if (!res.ok) return null
    const json = await res.json()
    return json.task?.name || null
  } catch {
    return null
  }
}

// Preenche o título dos links de pacote antigos (salvos antes de existir a
// coluna title). Grava no banco pra fatura do cliente já exibir o título.
export async function fillMissingPackTitles(items: PackItem[]): Promise<PackItem[]> {
  const missing = items.filter(i => !i.title)
  if (!missing.length) return items

  const titles = await Promise.all(missing.map(i => fetchClickUpTitle(i.url)))
  const updates = new Map<string, string>()
  missing.forEach((item, n) => {
    if (titles[n]) updates.set(item.id, titles[n]!)
  })
  if (!updates.size) return items

  await Promise.all(
    [...updates].map(([id, title]) => supabase.from('pack_items').update({ title }).eq('id', id))
  )
  return items.map(i => (updates.has(i.id) ? { ...i, title: updates.get(i.id)! } : i))
}
