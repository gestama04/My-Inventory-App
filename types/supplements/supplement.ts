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
  reminder_time?: string | null
  days_of_week: number[]
  photo_url?: string | null
  photo_public_id?: string | null
  is_active?: boolean
  created_at?: string
  updated_at?: string
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
}