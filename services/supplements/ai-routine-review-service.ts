import { GoogleGenerativeAI } from '@google/generative-ai'
import { Supplement } from '../../types/supplements/supplement'

const genAI = new GoogleGenerativeAI(
  process.env.EXPO_PUBLIC_GEMINI_API_KEY as string
)

export type AIRoutineReview = {
  summary: string
  positives: string[]
  pointsToCheck: string[]
  timingNotes: string[]
  professionalQuestions: string[]
  disclaimer: string
}

function extractJson(text: string) {
  const cleaned = text.replace(/```json|```/g, '').trim()
  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('Resposta da IA não contém JSON válido')
  }

  return cleaned.slice(firstBrace, lastBrace + 1)
}

export async function reviewSupplementRoutine(
  supplements: Supplement[]
): Promise<AIRoutineReview> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })

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

  const prompt = `
Analisa esta rotina de suplementos de forma geral e educativa.

Devolve APENAS JSON válido, sem markdown.

Formato obrigatório:
{
  "summary": string,
  "positives": string[],
  "pointsToCheck": string[],
  "timingNotes": string[],
  "professionalQuestions": string[],
  "disclaimer": string
}

Dados:
${JSON.stringify(compactSupplements, null, 2)}

Regras:
- Não dês diagnóstico.
- Não digas que a rotina está "certa" ou "errada".
- Não recomendes doses.
- Não substituas aconselhamento médico.
- Podes apontar possíveis duplicações de ingredientes.
- Podes apontar doses que parecem merecer confirmação, sem afirmar perigo.
- Podes comentar horários de forma geral.
- Podes explicar benefícios gerais dos ingredientes.
- Usa português de Portugal.
- Máximo 5 itens por lista.
- O disclaimer deve dizer: "Informação geral. Não substitui aconselhamento médico. Segue sempre a recomendação do teu profissional de saúde."
`

  const result = await model.generateContent(prompt)
  const text = result.response.text()
  const json = extractJson(text)
  const parsed = JSON.parse(json)

  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    positives: Array.isArray(parsed.positives) ? parsed.positives : [],
    pointsToCheck: Array.isArray(parsed.pointsToCheck) ? parsed.pointsToCheck : [],
    timingNotes: Array.isArray(parsed.timingNotes) ? parsed.timingNotes : [],
    professionalQuestions: Array.isArray(parsed.professionalQuestions)
      ? parsed.professionalQuestions
      : [],
    disclaimer:
      typeof parsed.disclaimer === 'string'
        ? parsed.disclaimer
        : 'Informação geral. Não substitui aconselhamento médico. Segue sempre a recomendação do teu profissional de saúde.',
  }
}