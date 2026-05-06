import { Supplement } from '../../types/supplements/supplement'

export type SupplementSuggestion = {
  reminderTime: string
  daysOfWeek: number[]
  note: string
  caution?: string
}

export function getSupplementSuggestion(input: {
  name?: string
  mainIngredient?: string
  dosageAmount?: number | null
  dosageUnit?: string | null
}): SupplementSuggestion {
  const text = `${input.name ?? ''} ${input.mainIngredient ?? ''}`.toLowerCase()
  const amount = input.dosageAmount
  const unit = input.dosageUnit

  let reminderTime = '09:00'
  let note = 'Sugestão: escolhe uma hora fácil de repetir todos os dias para criares hábito.'
  let caution: string | undefined

  const has = (...words: string[]) => words.some((word) => text.includes(word))

  if (has('vitamina d', 'd3', 'k2', 'mk-7')) {
    reminderTime = '09:00'
    note = 'Sugestão: vitamina D/K é muitas vezes tomada com uma refeição.'
  }

  if (has('magnésio', 'magnesium', 'bisglicinato', 'glycinate')) {
    reminderTime = '21:00'
    note = 'Sugestão: o magnésio é muitas vezes tomado ao fim do dia.'
  }

  if (has('omega', 'ómega', 'fish oil', 'epa', 'dha')) {
    reminderTime = '13:00'
    note = 'Sugestão: ómega 3 é muitas vezes tomado com uma refeição.'
  }

  if (has('creatina', 'creatine')) {
    reminderTime = '10:00'
    note = 'Sugestão: para creatina, o mais importante costuma ser manter consistência diária.'
  }

  if (has('probiótico', 'probiotic')) {
    reminderTime = '08:00'
    note = 'Sugestão: probióticos são muitas vezes tomados numa rotina matinal.'
  }

  if (has('ferro', 'iron')) {
    reminderTime = '08:00'
    note = 'Sugestão: ferro pode merecer atenção ao horário e interações com outros suplementos.'
    caution = 'Atenção: confirma as instruções do rótulo ou de um profissional de saúde, especialmente se também tomares cálcio, magnésio ou medicação.'
  }

  if (has('zinco', 'zinc')) {
    reminderTime = '13:00'
    note = 'Sugestão: zinco é muitas vezes tomado com comida para melhor tolerância.'
  }

  if (has('melatonina', 'melatonin')) {
    reminderTime = '22:00'
    note = 'Sugestão: melatonina é normalmente associada ao período antes de dormir.'
    caution = 'Atenção: confirma se é adequada para ti, especialmente se tomares medicação ou tiveres condições de saúde.'
  }

  if (
    has('vitamina d', 'd3') &&
    unit === 'IU' &&
    typeof amount === 'number' &&
    amount >= 4000
  ) {
    caution = 'Atenção: esta dose parece elevada. Confirma o rótulo e valida com um profissional de saúde se necessário.'
  }

  if (
    has('magnésio', 'magnesium') &&
    unit === 'mg' &&
    typeof amount === 'number' &&
    amount >= 400
  ) {
    caution = 'Atenção: confirma se esta quantidade corresponde ao magnésio elementar e se é adequada para ti.'
  }

  return {
    reminderTime,
    daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
    note,
    caution,
  }
}