import { NextRequest, NextResponse } from 'next/server'

const BASE = 'https://api.clickup.com/api/v2'

async function cu(path: string, token: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: token },
    cache: 'no-store',
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.err || `ClickUp error ${res.status}`)
  return json
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')
  const token = searchParams.get('token') || ''

  if (!token) return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 })

  try {
    if (action === 'teams') {
      const data = await cu('/team', token)
      return NextResponse.json(data)
    }

    if (action === 'lists') {
      const teamId = searchParams.get('teamId')
      if (!teamId) return NextResponse.json({ error: 'teamId obrigatório' }, { status: 400 })

      const spacesData = await cu(`/team/${teamId}/space?archived=false`, token)
      const spaces = spacesData.spaces || []

      const lists: any[] = []
      for (const space of spaces) {
        // listas diretas no espaço
        const direct = await cu(`/space/${space.id}/list?archived=false`, token)
        for (const l of direct.lists || []) {
          lists.push({ id: l.id, name: l.name, space: space.name })
        }
        // listas dentro de pastas
        const folders = await cu(`/space/${space.id}/folder?archived=false`, token)
        for (const folder of folders.folders || []) {
          const fl = await cu(`/folder/${folder.id}/list?archived=false`, token)
          for (const l of fl.lists || []) {
            lists.push({ id: l.id, name: l.name, space: space.name, folder: folder.name })
          }
        }
      }
      return NextResponse.json({ lists })
    }

    if (action === 'tasks') {
      const listIds = (searchParams.get('listIds') || '').split(',').filter(Boolean)
      if (!listIds.length) return NextResponse.json({ error: 'listIds obrigatório' }, { status: 400 })

      const tasks: any[] = []
      for (const id of listIds) {
        const status = encodeURIComponent('APROVAÇÃO')
        const data = await cu(`/list/${id}/task?statuses[]=${status}&archived=false&include_closed=false`, token)
        for (const t of data.tasks || []) {
          tasks.push({ id: t.id, name: t.name, url: t.url, status: t.status?.status })
        }
      }
      return NextResponse.json({ tasks })
    }

    if (action === 'task') {
      const url = searchParams.get('url') || ''
      // Extrai o task ID da URL: https://app.clickup.com/t/{id} ou https://app.clickup.com/t/{workspace}/{id}
      const match = url.match(/\/t\/(?:[^/]+\/)?([a-zA-Z0-9]+)\/?$/)
      if (!match) return NextResponse.json({ error: 'URL inválida. Use o link direto do card do ClickUp.' }, { status: 400 })
      const taskId = match[1]
      const data = await cu(`/task/${taskId}`, token)
      return NextResponse.json({ task: { id: data.id, name: data.name, url: data.url, status: data.status?.status } })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
