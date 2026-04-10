import Anthropic from '@anthropic-ai/sdk'
import { CATEGORIES, type ProcessedRecipe } from './types'

const client = new Anthropic()

const SYSTEM_PROMPT = `אתה מחלץ מתכון מכרטיס מתכון כתוב ביד או מודפס בעברית.
ענה אך ורק עם JSON תקני בפורמט הבא, ללא טקסט נוסף:
{
  "title": "שם המתכון בעברית",
  "category": "אחת בדיוק מהרשימה: ${CATEGORIES.join(' | ')}",
  "ingredients": ["מצרך 1", "מצרך 2"],
  "instructions": "הוראות הכנה מלאות בעברית"
}
חשוב: הקטגוריה חייבת להיות אחת מהרשימה המצוינת בלבד.`

export function buildImageMessages(
  imageBase64List: string[],
  mimeTypes: string[]
): Anthropic.MessageParam[] {
  const imageContent: Anthropic.ImageBlockParam[] = imageBase64List.map(
    (data, i) => ({
      type: 'image',
      source: {
        type: 'base64',
        media_type: (mimeTypes[i] || 'image/jpeg') as
          | 'image/jpeg'
          | 'image/png'
          | 'image/webp'
          | 'image/gif',
        data,
      },
    })
  )
  return [
    {
      role: 'user',
      content: [
        ...imageContent,
        { type: 'text', text: 'חלץ את המתכון מהתמונות.' },
      ],
    },
  ]
}

export function buildTranscriptionMessages(
  transcription: string
): Anthropic.MessageParam[] {
  return [
    {
      role: 'user',
      content: `הנה תמלול של מתכון שהוקלט בקול. ארגן אותו כמתכון:\n\n${transcription}`,
    },
  ]
}

export async function processImages(
  imageBase64List: string[],
  mimeTypes: string[]
): Promise<ProcessedRecipe> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: buildImageMessages(imageBase64List, mimeTypes),
  })
  const text =
    response.content[0].type === 'text' ? response.content[0].text : ''
  return JSON.parse(text) as ProcessedRecipe
}

export async function processTranscription(
  transcription: string
): Promise<ProcessedRecipe> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: buildTranscriptionMessages(transcription),
  })
  const text =
    response.content[0].type === 'text' ? response.content[0].text : ''
  return JSON.parse(text) as ProcessedRecipe
}
