export type DosageUnit =
  | 'mg'
  | 'mcg'
  | 'IU'
  | 'g'
  | 'ml'
  | 'capsule'
  | 'tablet'
  | 'drop'
  | ''

export type SupplementFrequencyType =
  | 'daily'
  | 'specific_days'
  | 'every_other_day'
  | 'custom_interval'

export type ActiveIngredient = {
  name: string
  amount: number | null
  unit: string | null
}

export type Supplement = {
  id?: string
  user_id?: string
  name: string
  brand?: string | null
  main_ingredient?: string | null
  dosage_amount?: number | null
  dosage_unit?: DosageUnit | string | null
  serving_size?: string | null
  container_quantity?: number | null
  instructions_from_label?: string | null
  ai_insights?: SupplementAIInsights | null

  reminder_time?: string | null
  reminder_times?: string[]

  frequency_type?: SupplementFrequencyType
  times_per_day?: number
  days_of_week: number[]
  start_date?: string | null
  interval_days?: number | null

  photo_url?: string | null
  photo_public_id?: string | null
  is_active?: boolean
  created_at?: string
  updated_at?: string
  active_ingredients?: ActiveIngredient[] | null
  notification_ids?: string[] | null
}

export type SupplementAnalysisResult = {
  name: string | null
  brand: string | null
  mainIngredient: string | null
  dosageAmount: number | null
  dosageUnit: DosageUnit | string | null
  servingSize: string | null
  containerQuantity: number | null
  instructionsFromLabel: string | null
  confidence: number
  activeIngredients?: ActiveIngredient[]
  aiInsights?: SupplementAIInsights
}

export type SupplementAIInsights = {
  summary: string | null
  benefits: string[]
  cautions: string[]
}