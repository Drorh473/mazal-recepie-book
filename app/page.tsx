import { getAllRecipes } from '@/lib/recipes'
import RecipeBook from '@/components/RecipeBook'

export default async function HomePage() {
  const recipes = await getAllRecipes()
  return <RecipeBook recipes={recipes} />
}
