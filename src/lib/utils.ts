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

export function calculateJobValue(job: { type: string; hours?: number | null; hourly_rate: number; fixed_value?: number | null }): number {
  if (job.type === 'hora') {
    return (job.hours || 0) * job.hourly_rate
  }
  return job.fixed_value || 0
}

export const CLIENT_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
  '#8b5cf6', '#f97316', '#06b6d4', '#84cc16', '#ec4899',
]
