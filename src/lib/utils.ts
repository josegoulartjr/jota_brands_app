import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date + 'T00:00:00'))
}

export const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

export function getMonthName(month: number): string {
  return MONTHS[month - 1]
}

export function calculateJobValue(job: {
  type: string
  hours?: number | null
  hourly_rate: number
  fixed_value?: number | null
  pack_delivered?: number | null
  pack_total?: number | null
}): number {
  if (job.type === 'hora') {
    return (job.hours || 0) * job.hourly_rate
  }
  if (job.type === 'pacote') {
    const delivered = job.pack_delivered || 0
    const total = job.pack_total || 10
    return delivered >= total ? (job.fixed_value || 0) : 0
  }
  return job.fixed_value || 0
}

export function getPackTag(job: {
  pack_origin_month?: number | null
  pack_origin_year?: number | null
  pack_delivered?: number | null
  pack_total?: number | null
}): string {
  const month = job.pack_origin_month ? getMonthName(job.pack_origin_month) : '?'
  const year = job.pack_origin_year ?? '?'
  const delivered = job.pack_delivered ?? 0
  const total = job.pack_total ?? 10
  return `Pacote ${month}/${year} · ${delivered}/${total}`
}

interface PackProgressInput {
  pack_total?: number | null
  pack_delivered?: number | null
  completed_at?: string | null
  period_month: number
  period_year: number
}

interface PackProgressPatch {
  pack_delivered: number
  completed_at: string | null
  period_month: number
  period_year: number
}

// Ao completar o pack (delivered atinge total), o período de faturamento é
// automaticamente ajustado para o mês/ano atual (quando o pack de fato fecha),
// mantendo pack_origin_month/year como a tag fixa de origem do pack.
export function computePackProgress(current: PackProgressInput, newDelivered: number): PackProgressPatch {
  const total = current.pack_total ?? 10
  const delivered = Math.max(0, Math.min(newDelivered, total))
  const wasComplete = (current.pack_delivered ?? 0) >= total && !!current.completed_at
  const isComplete = delivered >= total

  if (isComplete && !wasComplete) {
    const now = new Date()
    return {
      pack_delivered: delivered,
      completed_at: now.toISOString(),
      period_month: now.getMonth() + 1,
      period_year: now.getFullYear(),
    }
  }
  if (!isComplete && wasComplete) {
    return {
      pack_delivered: delivered,
      completed_at: null,
      period_month: current.period_month,
      period_year: current.period_year,
    }
  }
  return {
    pack_delivered: delivered,
    completed_at: current.completed_at ?? null,
    period_month: current.period_month,
    period_year: current.period_year,
  }
}

export const CLIENT_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
  '#8b5cf6', '#f97316', '#06b6d4', '#84cc16', '#ec4899',
]
