export type JobType = 'hora' | 'fechado' | 'pacote'
export type JobStatus = 'concluido' | 'faturado' | 'pago'
export type TransactionType = 'entrada' | 'saida'

export interface Client {
  id: string
  name: string
  color: string
  created_at: string
}

export interface Job {
  id: string
  name: string
  client_id: string
  client?: Client
  period_month: number
  period_year: number
  type: JobType
  hours?: number
  hourly_rate: number
  fixed_value?: number
  clickup_url?: string
  status: JobStatus
  notes?: string
  created_at: string
  pack_delivered?: number
  pack_total?: number
  pack_origin_month?: number
  pack_origin_year?: number
  completed_at?: string | null
}

export interface JobComment {
  id: string
  job_id: string
  text: string
  created_at: string
}

export interface PackItem {
  id: string
  job_id: string
  url: string
  created_at: string
}

export interface Transaction {
  id: string
  description: string
  type: TransactionType
  amount: number
  category: string
  date: string
  client_id?: string
  client?: Client
  job_id?: string
  notes?: string
  created_at: string
}

export interface Settings {
  id: string
  pix_key: string
  pix_key_type: string
  company_name: string
  payment_link?: string
  hourly_rate: number
  clickup_token?: string
  clickup_list_ids?: string
}

export type Database = {
  public: {
    Tables: {
      clients: {
        Row: Client
        Insert: Omit<Client, 'id' | 'created_at'>
        Update: Partial<Omit<Client, 'id' | 'created_at'>>
      }
      jobs: {
        Row: Job
        Insert: Omit<Job, 'id' | 'created_at' | 'client'>
        Update: Partial<Omit<Job, 'id' | 'created_at' | 'client'>>
      }
      transactions: {
        Row: Transaction
        Insert: Omit<Transaction, 'id' | 'created_at' | 'client'>
        Update: Partial<Omit<Transaction, 'id' | 'created_at' | 'client'>>
      }
      settings: {
        Row: Settings
        Insert: Omit<Settings, 'id'>
        Update: Partial<Omit<Settings, 'id'>>
      }
      job_comments: {
        Row: JobComment
        Insert: Omit<JobComment, 'id' | 'created_at'>
        Update: Partial<Omit<JobComment, 'id' | 'created_at'>>
      }
      pack_items: {
        Row: PackItem
        Insert: Omit<PackItem, 'id' | 'created_at'>
        Update: Partial<Omit<PackItem, 'id' | 'created_at'>>
      }
    }
  }
}
