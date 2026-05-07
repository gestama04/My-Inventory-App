import { GoogleGenerativeAI } from '@google/generative-ai'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY') ?? '')

const GEMINI_MODELS = [
  'gemini-3.1-flash-lite-preview',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
]

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

async function generateWithFallback(parts: any[]) {
  let lastError: unknown = null

  for (const modelName of GEMINI_MODELS) {
    try {
      console.log('Trying Gemini model:', modelName)

      const model = genAI.getGenerativeModel({
        model: modelName,
      })

      return await model.generateContent(parts)
    } catch (error) {
      console.error(`Gemini model failed: ${modelName}`, error)
      lastError = error
    }
  }

  throw lastError
}

function extractJson(text: string) {
  const cleaned = text.replace(/```json|```/g, '').trim()
  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('Resposta IA inválida')
  }

  return cleaned.slice(firstBrace, lastBrace + 1)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    })
  }

  try {
    const { supplements } = await req.json()

    if (!Array.isArray(supplements)) {
      return jsonResponse({ error: 'supplements inválido' }, 400)
    }

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
${JSON.stringify(supplements, null, 2)}

Regras:
- Não dês diagnóstico.
- Não digas que a rotina está "certa" ou "errada".
- Não recomendes doses.
- Não substituas aconselhamento médico.
- Podes apontar possíveis duplicações de ingredientes.
- Podes apontar doses que parecem merecer confirmação.
- Podes comentar horários de forma geral.
- Podes explicar benefícios gerais dos ingredientes.
- Usa português de Portugal.
- Máximo 5 itens por lista.
- O disclaimer deve dizer:
"Informação geral. Não substitui aconselhamento médico. Segue sempre a recomendação do teu profissional de saúde."
`

    const result = await generateWithFallback([prompt])
    const text = result.response.text()
    const parsed = JSON.parse(extractJson(text))

    return jsonResponse({
      summary:
        typeof parsed.summary === 'string'
          ? parsed.summary
          : '',

      positives: Array.isArray(parsed.positives)
        ? parsed.positives
        : [],

      pointsToCheck: Array.isArray(parsed.pointsToCheck)
        ? parsed.pointsToCheck
        : [],

      timingNotes: Array.isArray(parsed.timingNotes)
        ? parsed.timingNotes
        : [],

      professionalQuestions: Array.isArray(parsed.professionalQuestions)
        ? parsed.professionalQuestions
        : [],

      disclaimer:
        typeof parsed.disclaimer === 'string'
          ? parsed.disclaimer
          : 'Informação geral. Não substitui aconselhamento médico. Segue sempre a recomendação do teu profissional de saúde.',
    })
  } catch (error) {
    console.error('REVIEW_ROUTINE_ERROR:', error)

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro interno',
      },
      500
    )
  }
})