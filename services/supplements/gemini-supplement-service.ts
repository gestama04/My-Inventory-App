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
  "servingSize": string | null,
  "containerQuantity": number | null,
  "instructionsFromLabel": string | null,
  "confidence": number
}

Regras:
- Usa apenas informação visível no rótulo.
- Não inventes.
- Se não tiveres certeza, usa null.
- Não dês conselhos médicos.
- Não recomendes doses.
- Se vires "IU", "I.U.", "UI" ou "Unidades Internacionais", devolve dosageUnit: "IU".
- Se vires "mcg", "µg" ou "ug", devolve dosageUnit: "mcg".
- Se vires "mg", devolve dosageUnit: "mg".
- Se vires "5000 IU", devolve dosageAmount: 5000 e dosageUnit: "IU".
- Se o produto tiver vários ingredientes principais, usa mainIngredient como texto curto, exemplo: "Vitamina D3 + MK-7".
- "instructionsFromLabel" deve conter apenas instruções visíveis no rótulo.
- "confidence" deve ser entre 0 e 1.
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

const allowedUnits = ['mg', 'mcg', 'IU', 'g', 'ml', 'capsule', 'tablet', 'drop']

const dosageUnit = normalizedUnit && allowedUnits.includes(normalizedUnit)
  ? normalizedUnit
  : null

    return {
      name: parsed.name ?? null,
      brand: parsed.brand ?? null,
      mainIngredient: parsed.mainIngredient ?? null,
      dosageAmount: parsed.dosageAmount ?? null,
      dosageUnit,
      servingSize: parsed.servingSize ?? null,
      containerQuantity: parsed.containerQuantity ?? null,
      instructionsFromLabel: parsed.instructionsFromLabel ?? null,
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
    }
  }
}