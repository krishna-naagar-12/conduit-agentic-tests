import { request } from '@playwright/test'

import { apiRoot, env } from '../config/env'

/**
 * Fails fast when the app under test is not running.
 *
 * Without this, a stopped backend produces dozens of confusing ECONNREFUSED
 * failures. With it, the run stops immediately with the exact commands needed to
 * fix the situation — which matters for humans and matters more for an agent,
 * which would otherwise try to "fix" perfectly good test code.
 */

const SETUP_INSTRUCTIONS = `
The Conduit app under test is not reachable.

Start it in a separate terminal:

  git clone --recurse-submodules https://github.com/cirosantilli/node-express-sequelize-realworld-example-app
  cd node-express-sequelize-realworld-example-app
  npm install            # see README.md if the sqlite3 native build fails
  npm run dev            # backend :3000 + frontend :4101

Expected endpoints:
  API : ${env.apiBaseUrl}
  UI  : ${env.uiBaseUrl}

Override these with API_BASE_URL / UI_BASE_URL (see .env.example).
`

async function probe(url: string, label: string): Promise<string | null> {
  const context = await request.newContext({ timeout: 5_000 })
  try {
    const response = await context.get(url)
    if (!response.ok()) {
      return `${label} responded with HTTP ${response.status()} at ${url}`
    }
    return null
  } catch (error) {
    const reason = error instanceof Error ? error.message.split('\n')[0] : String(error)
    return `${label} is unreachable at ${url} (${reason})`
  } finally {
    await context.dispose()
  }
}

export default async function globalSetup(): Promise<void> {
  const failures = (
    await Promise.all([
      probe(`${apiRoot}/articles?limit=1`, 'Backend API'),
      probe(env.uiBaseUrl, 'Frontend UI'),
    ])
  ).filter((failure): failure is string => failure !== null)

  if (failures.length > 0) {
    throw new Error(
      ['Preflight check failed:', ...failures.map((f) => `  - ${f}`), SETUP_INSTRUCTIONS].join('\n'),
    )
  }
}
