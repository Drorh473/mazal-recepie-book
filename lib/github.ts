export function generateSlug(title: string): string {
  const timestamp = Date.now()
  const sanitized = title
    .replace(/[^\u0590-\u05FFa-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `${sanitized}-${timestamp}`
}

async function getFileSha(
  filePath: string,
  repo: string,
  token: string,
  branch: string
): Promise<string | undefined> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  )
  if (res.status === 404) return undefined
  if (!res.ok) return undefined
  const data = await res.json()
  return data.sha as string
}

/** Check if a recipe with the same title already exists in GitHub */
export async function checkDuplicateTitle(title: string): Promise<boolean> {
  const repo = process.env.GITHUB_REPO!
  const token = process.env.GITHUB_TOKEN!
  const branch = process.env.GITHUB_BRANCH ?? 'main'

  // List all files in data/recipes/
  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/data/recipes?ref=${branch}`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  )

  if (!res.ok) return false // if we can't check, allow save

  const files = (await res.json()) as Array<{ name: string; download_url: string }>
  const normalizedTitle = title.trim().replace(/\s+/g, ' ')

  // Check each recipe file for matching title
  for (const file of files) {
    if (!file.name.endsWith('.json')) continue
    try {
      const fileRes = await fetch(file.download_url)
      if (!fileRes.ok) continue
      const recipe = (await fileRes.json()) as { title?: string }
      if (recipe.title && recipe.title.trim().replace(/\s+/g, ' ') === normalizedTitle) {
        return true
      }
    } catch {
      continue
    }
  }

  return false
}

export async function commitFile(params: {
  path: string
  content: string // base64-encoded
  message: string
  branch?: string
}): Promise<void> {
  const repo = process.env.GITHUB_REPO!
  const token = process.env.GITHUB_TOKEN!
  const branch = params.branch ?? process.env.GITHUB_BRANCH ?? 'main'

  const sha = await getFileSha(params.path, repo, token, branch)

  const body: Record<string, string> = {
    message: params.message,
    content: params.content,
    branch,
  }
  if (sha) body.sha = sha

  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/${params.path}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`GitHub API error: ${err.message}`)
  }
}
