import fs from 'fs'
import path from 'path'
import { cacheLife, cacheTag } from 'next/cache'
import type { Recipe } from './types'

const RECIPES_DIR = path.join(process.cwd(), 'data', 'recipes')

export async function getAllRecipes(): Promise<Recipe[]> {
  'use cache'
  cacheTag('recipes')
  cacheLife('minutes')

  if (!fs.existsSync(RECIPES_DIR)) return []

  const files = fs
    .readdirSync(RECIPES_DIR)
    .filter((f) => f.endsWith('.json'))

  return files
    .map((file) => {
      const content = fs.readFileSync(path.join(RECIPES_DIR, file), 'utf-8')
      return JSON.parse(content) as Recipe
    })
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
}
