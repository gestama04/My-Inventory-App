import { GoogleGenerativeAI } from '@google/generative-ai'
import { SupplementAnalysisResult } from '../../types/supplements/supplement'

const genAI = new GoogleGenerativeAI(
  process.env.EXPO_PUBLIC_GEMINI_API_KEY as string
)

function extractJson(text: string) {
  const cleaned = text.replace(/```json|```/g, '').trim()
  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('Resposta da IA não contém JSON válido')
  }

  return cleaned.slice(firstBrace, lastBrace + 1)
}

export async function analyzeSupplementLabel(
  imageBase64: string
): Promise<SupplementAnalysisResult> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })

    const prompt = `
Analisa esta imagem de um rótulo de suplemento, vitamina ou produto nutricional.

Devolve APENAS JSON válido, sem markdown e sem explicações.

Formato obrigatório:
{
  "name": string | null,
  "brand": string | null,
  "mainIngredient": string | null,
  "dosageAmount": number | null,
  "dosageUnit": "mg" | "mcg" | "IU" | "g" | "ml" | "capsule" | "tablet" | "drop" | null,
  "activeIngredients": [
    {
      "name": string,
      "amount": number | null,
      "unit": "mg" | "mcg" | "IU" | "g" | "ml" | null
    }
  ],
  "servingSize": string | null,
  "containerQuantity": number | null,
  "instructionsFromLabel": string | null,
  "confidence": number,
  "aiInsights": {
  "summary": string | null,
  "benefits": string[],
  "cautions": string[]
}
}

Regras:
- Usa apenas informação visível no rótulo.
- Não inventes.
- Se não tiveres certeza, usa null.
- Não dês conselhos médicos.
- Não recomendes doses.
- Se vires "IU", "I.U.", "UI" ou "Unidades Internacionais", usa "IU".
- Se vires "mcg", "µg" ou "ug", usa "mcg".
- Se vires "5000 IU", separa como amount: 5000 e unit: "IU".
- Se houver vários ingredientes com doses, coloca todos em activeIngredients.
- Exemplo: "Vitamin D3 5000 IU / Vitamin K2 MK-7 180 mcg" deve gerar activeIngredients com D3 e K2.
- mainIngredient deve ser resumo curto, exemplo: "Vitamina D3 + K2 (MK-7)".
- dosageAmount e dosageUnit devem representar a dose principal mais visível no rótulo.
- Se existir número de cápsulas, comprimidos, tablets ou softgels, preenche containerQuantity.
- Se aparecer "60 capsules", containerQuantity deve ser 60.
- servingSize deve ser a toma se estiver visível, exemplo: "1 cápsula". Se não estiver visível, usa null.
- "instructionsFromLabel" deve conter apenas instruções visíveis no rótulo.
- "confidence" deve ser entre 0 e 1.
- "summary" deve ser uma explicação simples do suplemento (1 frase).
- "benefits" deve listar benefícios gerais conhecidos dos ingredientes (máx 5).
- "cautions" deve listar avisos gerais (máx 5).
- Não dar conselhos médicos.
- Não recomendar doses.
- Não dizer que trata doenças.
- Usa linguagem neutra e informativa.
- Usa português de Portugal quando aplicável.
`

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBase64,
        },
      },
    ])

    const text = result.response.text()
    const json = extractJson(text)
    const parsed = JSON.parse(json)

const normalizedUnit =
  typeof parsed.dosageUnit === 'string'
    ? parsed.dosageUnit
        .replace('I.U.', 'IU')
        .replace('UI', 'IU')
        .replace('µg', 'mcg')
        .replace('ug', 'mcg')
        .trim()
    : null

const toNumberOrNull = (value: unknown) => {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const number = Number(value.replace(',', '.'))
    return Number.isFinite(number) ? number : null
  }
  return null
}

const allowedUnits = ['mg', 'mcg', 'IU', 'g', 'ml', 'capsule', 'tablet', 'drop']

const dosageUnit = normalizedUnit && allowedUnits.includes(normalizedUnit)
  ? normalizedUnit
  : null

const normalizeUnit = (unit: unknown) => {
  if (typeof unit !== 'string') return null

  const normalized = unit
    .replace('I.U.', 'IU')
    .replace('UI', 'IU')
    .replace('µg', 'mcg')
    .replace('ug', 'mcg')
    .replace('softgels', 'capsule')
    .replace('softgel', 'capsule')
    .replace('capsules', 'capsule')
    .replace('capsule', 'capsule')
    .replace('comprimidos', 'tablet')
    .replace('comprimido', 'tablet')
    .replace('tablets', 'tablet')
    .replace('drops', 'drop')
    .trim()

  return allowedUnits.includes(normalized) ? normalized : null
}

const activeIngredients = Array.isArray(parsed.activeIngredients)
  ? parsed.activeIngredients
      .map((ingredient: any) => ({
        name: typeof ingredient.name === 'string' ? ingredient.name : '',
        amount: toNumberOrNull(ingredient.amount),
        unit: normalizeUnit(ingredient.unit),
      }))
      .filter((ingredient: any) => ingredient.name.trim().length > 0)
  : []

    return {
  name: parsed.name ?? null,
  brand: parsed.brand ?? null,
  mainIngredient: parsed.mainIngredient ?? null,
  dosageAmount: toNumberOrNull(parsed.dosageAmount),
  dosageUnit,
  activeIngredients,
  servingSize: parsed.servingSize ?? null,
  containerQuantity: toNumberOrNull(parsed.containerQuantity),
  instructionsFromLabel: parsed.instructionsFromLabel ?? null,
  aiInsights: {
  summary:
    typeof parsed.aiInsights?.summary === 'string'
      ? parsed.aiInsights.summary
      : null,
  benefits: Array.isArray(parsed.aiInsights?.benefits)
    ? parsed.aiInsights.benefits
    : [],
  cautions: Array.isArray(parsed.aiInsights?.cautions)
    ? parsed.aiInsights.cautions
    : [],
},
  confidence:
    typeof parsed.confidence === 'number' ? parsed.confidence : 0,
}
  } catch (error) {
    console.error('Erro ao analisar suplemento:', error)

    return {
      name: null,
      brand: null,
      mainIngredient: null,
      dosageAmount: null,
      dosageUnit: null,
      servingSize: null,
      containerQuantity: null,
      instructionsFromLabel: null,
      confidence: 0,
      aiInsights: {
  summary: null,
  benefits: [],
  cautions: [],
},
    }
  }
}