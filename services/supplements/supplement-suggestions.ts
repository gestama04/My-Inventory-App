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

  let reminderTime = '09:00'
  let note = 'Sugestão: toma à mesma hora todos os dias para criares hábito.'
  let caution: string | undefined

  if (text.includes('vitamina d') || text.includes('d3') || text.includes('k2') || text.includes('mk-7')) {
    reminderTime = '09:00'
    note = 'Sugestão: muitas pessoas tomam vitamina D/K com uma refeição.'
  }

  if (text.includes('magnésio') || text.includes('magnesium')) {
    reminderTime = '21:00'
    note = 'Sugestão: o magnésio é muitas vezes tomado ao fim do dia.'
  }

  if (text.includes('omega') || text.includes('ómega') || text.includes('fish oil')) {
    reminderTime = '13:00'
    note = 'Sugestão: ómega 3 é muitas vezes tomado com uma refeição.'
  }

  if (text.includes('creatina') || text.includes('creatine')) {
    reminderTime = '10:00'
    note = 'Sugestão: escolhe uma hora fácil de repetir todos os dias.'
  }

  if (
    (text.includes('vitamina d') || text.includes('d3')) &&
    input.dosageUnit === 'IU' &&
    typeof input.dosageAmount === 'number' &&
    input.dosageAmount >= 4000
  ) {
    caution = 'Atenção: esta dose parece elevada. Confirma o rótulo e, se necessário, valida com um profissional de saúde.'
  }

  return {
    reminderTime,
    daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
    note,
    caution,
  }
}