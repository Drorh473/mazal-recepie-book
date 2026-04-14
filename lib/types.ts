export const CATEGORIES = [
  'סלטים', 'דגים', 'בשר', 'פשטידות',
  'עוגות', 'עוגיות', 'חגים', 'מרקים',
  'מאפים', 'ריבות ומטבלים',
] as const

export type Category = (typeof CATEGORIES)[number]

export interface Recipe {
  id: string
  title: string
  category: Category
  ingredients: string[]
  instructions: string
  audioPath?: string
  createdAt: string
}

export interface ProcessedRecipe {
  title: string
  category: Category
  ingredients: string[]
  instructions: string
}

export interface ApiError {
  error: 'rate_limit' | 'api_error' | 'invalid_input' | 'save_error' | 'duplicate'
  message: string
  retryAfter?: number
}
