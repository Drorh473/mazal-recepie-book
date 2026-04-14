import Anthropic from '@anthropic-ai/sdk'
import { CATEGORIES, type ProcessedRecipe } from './types'

const client = new Anthropic()

/** Strip markdown code fences (```json ... ```) that Claude sometimes adds */
function extractJSON(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  return fenced ? fenced[1].trim() : raw.trim()
}

const SYSTEM_PROMPT = `אתה מומחה בקריאת מתכונים בעברית מתמונות — כולל כתב יד, דפוס ישן, וצילומים באיכות נמוכה.

## הנחיות לקריאת התמונה:
- קרא כל מילה בקפידה. אם מילה לא ברורה, נסה להבין מהקשר המתכון.
- שים לב לקיצורים נפוצים: כ׳ = כוס, כפ׳ = כף, כפית׳ = כפית, ק״ג = קילוגרם, גר׳ = גרם.
- אל תדלג על מרכיבים או שלבים — העתק הכל.
- אם יש כמויות, שמור עליהן ליד המרכיב (למשל: "2 כוסות קמח").
- שמור על סדר השלבים כפי שמופיע בתמונה.
- אם יש מספר תמונות, חבר אותן למתכון אחד שלם.

## פורמט התשובה:
ענה אך ורק עם JSON תקני, ללא טקסט נוסף, בפורמט:
{
  "title": "שם המתכון בעברית",
  "category": "אחת בדיוק מהרשימה: ${CATEGORIES.join(' | ')}",
  "ingredients": ["2 כוסות קמח", "3 ביצים", "כף שמן"],
  "instructions": "1. שלב ראשון. 2. שלב שני. 3. שלב שלישי."
}

## חשוב:
- הקטגוריה חייבת להיות אחת מהרשימה בלבד.
- כל מרכיב בשורה נפרדת במערך ingredients.
- הוראות ההכנה חייבות להיות ממוספרות (1. 2. 3.) גם אם בתמונה הן לא ממוספרות.
- אל תוסיף מידע שלא מופיע בתמונה. אל תמציא מרכיבים או שלבים.`

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
        { type: 'text', text: 'קרא בעיון את התמונה/תמונות וחלץ את המתכון המלא. שים לב לכל מילה, כמות ומרכיב. אם הכתב לא ברור, נסה להבין מהקשר.' },
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
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: buildImageMessages(imageBase64List, mimeTypes),
  })
  const text =
    response.content[0].type === 'text' ? response.content[0].text : ''
  return JSON.parse(extractJSON(text)) as ProcessedRecipe
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
  return JSON.parse(extractJSON(text)) as ProcessedRecipe
}
