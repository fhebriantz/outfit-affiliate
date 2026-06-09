export type PostingStatus = 'draft' | 'generated' | 'posted'

export interface Posting {
  id: string
  user_id: string
  tanggal: string // YYYY-MM-DD
  label: string | null
  ref_nama: string | null
  ref_url: string | null
  ref_tanggal: string | null
  caption_hashtags: string | null
  catatan: string | null
  drive_url: string | null
  status: PostingStatus
  archived_at: string | null
  created_at: string
}

export interface PostingImage {
  id: string
  posting_id: string
  user_id: string
  path: string
  caption: string | null
  created_at: string
}

export interface Item {
  id: string
  posting_id: string
  user_id: string
  urutan: number
  my_number: number
  kategori: string | null
  ref_code: string | null
  source_link: string | null
  affiliate_link: string | null
  created_at: string
}

export interface Settings {
  user_id: string
  default_hashtags: string
  kategori_presets: string[]
  last_number: number
}

export const DEFAULT_HASHTAGS = '#recomendationoutfithijab #hijaboutfit #hijabootd'
export const DEFAULT_KATEGORI = ['blouse', 'rok', 'sepatu', 'outer', 'celana', 'dress', 'kerudung', 'tas']
