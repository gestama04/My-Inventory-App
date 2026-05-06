import { supabase } from '../../supabase-config'
import { Supplement } from '../../types/supplements/supplement'

export type AICoachMessage = {
  title: string
  message: string
  type: 'positive' | 'warning' | 'timing' | 'question' | 'info'
}

export type AICoachResult = {
  summary: string
  messages: AICoachMessage[]
  disclaimer: string
}

function normalizeText(value?: string | null) {
  return String(value ?? '').toLowerCase()
}

function getIngredientText(supplement: Supplement) {
  const active = Array.isArray(supplement.active_ingredients)
    ? supplement.active_ingredients.map((i: any) => i.name).join(' ')
    : ''

  return normalizeText(
    `${supplement.name} ${supplement.main_ingredient} ${active}`
  )
}

function hasAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word))
}

function formatDose(supplement: Supplement) {
  if (!supplement.dosage_amount || !supplement.dosage_unit) return null
  return `${supplement.dosage_amount} ${supplement.dosage_unit}`
}

export function generateLocalAICoachReview(
  supplements: Supplement[]
): AICoachResult {
  const messages: AICoachMessage[] = []

  if (supplements.length === 0) {
    return {
      summary: 'Ainda não tens suplementos suficientes para gerar uma análise.',
      messages: [],
      disclaimer:
        'Informação geral. Não substitui aconselhamento médico. Segue sempre a recomendação do teu profissional de saúde.',
    }
  }

  messages.push({
    type: 'positive',
    title: 'Rotina criada',
    message:
      'Ter os suplementos registados com horários é um bom primeiro passo para manter consistência.',
  })

  const ingredientGroups: Record<string, Supplement[]> = {
    'Vitamina D': [],
    Magnésio: [],
    'Ómega 3': [],
    Zinco: [],
    Ferro: [],
    Creatina: [],
    Melatonina: [],
  }

  supplements.forEach((supplement) => {
    const text = getIngredientText(supplement)

    if (hasAny(text, ['vitamina d', 'd3'])) ingredientGroups['Vitamina D'].push(supplement)
    if (hasAny(text, ['magnésio', 'magnesium'])) ingredientGroups['Magnésio'].push(supplement)
    if (hasAny(text, ['omega', 'ómega', 'epa', 'dha', 'fish oil'])) ingredientGroups['Ómega 3'].push(supplement)
    if (hasAny(text, ['zinco', 'zinc'])) ingredientGroups['Zinco'].push(supplement)
    if (hasAny(text, ['ferro', 'iron'])) ingredientGroups['Ferro'].push(supplement)
    if (hasAny(text, ['creatina', 'creatine'])) ingredientGroups['Creatina'].push(supplement)
    if (hasAny(text, ['melatonina', 'melatonin'])) ingredientGroups['Melatonina'].push(supplement)
  })

  Object.entries(ingredientGroups).forEach(([ingredient, items]) => {
    if (items.length > 1) {
      messages.push({
        type: 'warning',
        title: `Possível duplicação: ${ingredient}`,
        message: `Tens ${items.length} suplementos que parecem conter ${ingredient}. Confirma se não estás a duplicar o mesmo ingrediente sem intenção.`,
      })
    }
  })

  supplements.forEach((supplement) => {
    const text = getIngredientText(supplement)
    const dose = formatDose(supplement)

    if (
      hasAny(text, ['vitamina d', 'd3']) &&
      supplement.dosage_unit === 'IU' &&
      typeof supplement.dosage_amount === 'number' &&
      supplement.dosage_amount >= 4000
    ) {
      messages.push({
        type: 'warning',
        title: 'Vitamina D em dose elevada',
        message: `${supplement.name} tem ${dose}. Confirma esta dose com o rótulo e, se necessário, com um profissional de saúde.`,
      })
    }

    if (
      hasAny(text, ['magnésio', 'magnesium']) &&
      supplement.dosage_unit === 'mg' &&
      typeof supplement.dosage_amount === 'number' &&
      supplement.dosage_amount >= 400
    ) {
      messages.push({
        type: 'warning',
        title: 'Magnésio a confirmar',
        message: `${supplement.name} tem ${dose}. Confirma se esta quantidade corresponde a magnésio elementar.`,
      })
    }

    if (hasAny(text, ['ferro', 'iron'])) {
      messages.push({
        type: 'question',
        title: 'Ferro merece confirmação',
        message:
          'Se tomares ferro, pode ser útil confirmar horários e possíveis interações com cálcio, magnésio, café, chá ou medicação.',
      })
    }

    if (hasAny(text, ['melatonina', 'melatonin'])) {
      messages.push({
        type: 'timing',
        title: 'Melatonina e horário',
        message:
          'A melatonina costuma estar associada ao período antes de dormir. Confirma se o horário escolhido faz sentido para a tua rotina.',
      })
    }
  })

  const morningCount = supplements.filter((s) =>
    String(s.reminder_time ?? s.reminder_times?.[0] ?? '').startsWith('09')
  ).length

  if (morningCount >= 3) {
    messages.push({
      type: 'timing',
      title: 'Muitas tomas na mesma altura',
      message:
        'Tens várias tomas concentradas de manhã. Pode ser prático, mas confirma se todos os suplementos fazem sentido juntos.',
    })
  }

  if (messages.length < 5) {
    messages.push({
      type: 'info',
      title: 'Pergunta útil',
      message:
        'Uma boa pergunta para um profissional de saúde seria: “Esta rotina faz sentido para os meus objetivos, análises e medicação atual?”',
    })
  }

  return {
    summary:
      'A tua rotina foi analisada de forma geral, com foco em consistência, possíveis duplicações, horários e pontos a confirmar.',
    messages: messages.slice(0, 8),
    disclaimer:
      'Informação geral. Não substitui aconselhamento médico. Segue sempre a recomendação do teu profissional de saúde.',
  }
}

export async function getAICoachReview(): Promise<AICoachResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Utilizador não autenticado')

  const { data, error } = await supabase
    .from('supplements')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) throw error

  return generateLocalAICoachReview((data || []) as Supplement[])
}