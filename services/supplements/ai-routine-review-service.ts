import { supabase } from '../../supabase-config'
import { Supplement } from '../../types/supplements/supplement'

export type AIRoutineReview = {
  summary: string
  positives: string[]
  pointsToCheck: string[]
  timingNotes: string[]
  professionalQuestions: string[]
  disclaimer: string
}

export async function reviewSupplementRoutine(
  supplements: Supplement[]
): Promise<AIRoutineReview> {
  try {
    const compactSupplements = supplements.map((item) => ({
      name: item.name,
      brand: item.brand,
      mainIngredient: item.main_ingredient,
      dosageAmount: item.dosage_amount,
      dosageUnit: item.dosage_unit,
      servingSize: item.serving_size,
      activeIngredients: item.active_ingredients,
      reminderTimes: item.reminder_times,
      reminderTime: item.reminder_time,
      frequencyType: item.frequency_type,
      daysOfWeek: item.days_of_week,
      instructionsFromLabel: item.instructions_from_label,
    }))

    const { data, error } = await supabase.functions.invoke(
      'review-supplement-routine',
      {
        body: {
          supplements: compactSupplements,
        },
      }
    )

    if (error) {
      throw error
    }

    return {
      summary: data.summary ?? '',
      positives: data.positives ?? [],
      pointsToCheck: data.pointsToCheck ?? [],
      timingNotes: data.timingNotes ?? [],
      professionalQuestions: data.professionalQuestions ?? [],
      disclaimer:
        data.disclaimer ??
        'Informação geral. Não substitui aconselhamento médico.',
    }
  } catch (error) {
    console.error('Erro IA rotina:', error)

    return {
      summary: '',
      positives: [],
      pointsToCheck: [],
      timingNotes: [],
      professionalQuestions: [],
      disclaimer:
        'Informação geral. Não substitui aconselhamento médico.',
    }
  }
}