import Anthropic from '@anthropic-ai/sdk'
import { CATEGORIES, type ProcessedRecipe } from './types'

const client = new Anthropic()

/**
 * Strip markdown code fences and handle prefill continuation.
 * With prefill trick: Claude response starts AFTER the '{', so we prepend it.
 */
function extractJSON(raw: string): string {
  // Strip markdown code fences if present
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const clean = fenced ? fenced[1].trim() : raw.trim()
  // Handle prefill case: response continues from '{', doesn't start with it
  return clean.startsWith('{') ? clean : '{' + clean
}

const SYSTEM_PROMPT = `אתה מומחה בפענוח כתב יד עברי של מתכוני אוכל — כולל כתב יד קשה לקריאה, כתב יד עקום, ודפוס ישן.

## כיצד לקרוא את התמונה:
- עבור על כל שורה לאט. אם אות לא ברורה — הסתכל על הצורה ונחש לפי הקשר המתכון.
- זכור: עברית נכתבת מימין לשמאל. מלל הפוך = כתב ראי, קרא אותו מהצד הנכון.
- כיצד לזהות אותיות דומות: ב/כ, ד/ר, ה/ח, ו/ז, מ/ס, ת/ח — השתמש בהקשר להחלטה.
- קיצורים נפוצים בכתב יד: כ׳/כוס, כפ׳/כף, כפית׳/כפית, ק״ג/קילוגרם, גר׳/גרם, ל׳/ליטר, מ״ל/מיליליטר, ח׳/חצי, רב׳/רבע.
- אם יש מספרים — קרא אותם כמות (½ = חצי, ¼ = רבע, ¾ = שלושה רבעים).
- אל תדלג על שום מרכיב או שלב — גם אם הכתב קשה. נחש לפי הקשר.
- שמור כמויות ליד המרכיב: "2 כוסות קמח" ולא "קמח" ו-"2" בנפרד.

## פורמט התשובה — JSON בלבד:
{
  "title": "שם המתכון בעברית",
  "category": "אחת בדיוק מהרשימה: ${CATEGORIES.join(' | ')}",
  "ingredients": ["2 כוסות קמח", "3 ביצים", "כף שמן זית"],
  "instructions": "1. שלב ראשון. 2. שלב שני. 3. שלב שלישי."
}

## כללים:
- הקטגוריה חייבת להיות אחת מהרשימה בלבד.
- כל מרכיב — פריט נפרד במערך ingredients.
- הוראות ממוספרות 1. 2. 3. גם אם בתמונה הן לא ממוספרות.
- אל תמציא מרכיבים. אם לא ברור — כתוב "?" ליד המילה הלא ברורה.`

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
        { type: 'text', text: 'עבור בעיון על כל שורה בתמונה. פענח את הכתב יד לפי הקשר. חלץ את המתכון המלא ללא השמטות.' },
      ],
    },
    // Prefill: forces Claude to start directly with JSON — no markdown fences possible
    { role: 'assistant', content: '{' },
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
    { role: 'assistant', content: '{' },
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
