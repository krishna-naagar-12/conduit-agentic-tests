/**
 * Generates AGENT_MANIFEST.json: a machine-readable index of everything a test
 * is allowed to call.
 *
 * Why this exists: the most common agent failure in a mature framework is calling
 * a helper that sounds right but does not exist — `users.createAdmin()`,
 * `api.deleteAllArticles()`. Documentation goes stale and cannot be verified. This
 * manifest is derived from the TypeScript AST, so it is correct by construction,
 * and `--check` fails CI when it drifts from the source. An agent reads one JSON
 * file and knows the exact, current surface.
 *
 * Usage:
 *   npm run manifest:generate   # write AGENT_MANIFEST.json
 *   npm run manifest:check      # fail if the committed manifest is stale
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import * as ts from 'typescript'

const REPO_ROOT = path.resolve(__dirname, '..')
const MANIFEST_PATH = path.join(REPO_ROOT, 'AGENT_MANIFEST.json')

interface MethodEntry {
  name: string
  signature: string
  doc?: string
}

interface ClassEntry {
  name: string
  file: string
  doc?: string
  methods: MethodEntry[]
}

interface FunctionEntry {
  name: string
  file: string
  signature: string
  doc?: string
}

interface Manifest {
  generatedBy: string
  description: string
  fixtures: { name: string; type: string; doc: string }[]
  classes: ClassEntry[]
  functions: FunctionEntry[]
  testTags: string[]
  commands: Record<string, string>
}

function readSource(file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.ES2022,
    /* setParentNodes */ true,
  )
}

/** Extracts the JSDoc summary attached to a node, collapsed to a single line. */
function jsDocOf(node: ts.Node): string | undefined {
  const docs = (node as unknown as { jsDoc?: ts.JSDoc[] }).jsDoc
  if (!docs || docs.length === 0) return undefined
  const comment = docs[docs.length - 1]?.comment
  if (!comment) return undefined
  const text = typeof comment === 'string' ? comment : comment.map((c) => c.text).join('')
  // First paragraph only — the manifest is an index, not the full documentation.
  const firstParagraph = text.split('\n\n')[0] ?? text
  return firstParagraph.replace(/\s+/g, ' ').trim()
}

function signatureOf(node: ts.MethodDeclaration | ts.FunctionDeclaration, source: ts.SourceFile): string {
  const name = node.name?.getText(source) ?? '(anonymous)'
  const params = node.parameters
    .map((parameter) => parameter.getText(source))
    .join(', ')
  const returnType = node.type ? `: ${node.type.getText(source)}` : ''
  return `${name}(${params})${returnType}`
}

function isExported(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined
  return modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false
}

function isPublicMethod(member: ts.ClassElement): boolean {
  const modifiers = ts.canHaveModifiers(member) ? ts.getModifiers(member) : undefined
  const hidden = modifiers?.some(
    (m) => m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword,
  )
  return !hidden
}

function collectFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return collectFiles(full)
    return entry.isFile() && entry.name.endsWith('.ts') ? [full] : []
  })
}

function buildManifest(): Manifest {
  const classes: ClassEntry[] = []
  const functions: FunctionEntry[] = []

  for (const file of collectFiles(path.join(REPO_ROOT, 'src'))) {
    const source = readSource(file)
    const relative = path.relative(REPO_ROOT, file)

    ts.forEachChild(source, (node) => {
      if (ts.isClassDeclaration(node) && node.name && isExported(node)) {
        const methods: MethodEntry[] = node.members
          .filter(ts.isMethodDeclaration)
          .filter(isPublicMethod)
          .map((member) => ({
            name: member.name.getText(source),
            signature: signatureOf(member, source),
            doc: jsDocOf(member),
          }))

        classes.push({
          name: node.name.text,
          file: relative,
          doc: jsDocOf(node),
          methods,
        })
      }

      if (ts.isFunctionDeclaration(node) && node.name && isExported(node)) {
        functions.push({
          name: node.name.text,
          file: relative,
          signature: signatureOf(node, source),
          doc: jsDocOf(node),
        })
      }
    })
  }

  const sortByName = <T extends { name: string }>(items: T[]): T[] =>
    [...items].sort((a, b) => a.name.localeCompare(b.name))

  return {
    generatedBy: 'npm run manifest:generate (do not edit by hand)',
    description:
      'Authoritative index of the helpers available to tests in this repository. ' +
      'Generated from the TypeScript AST. If a method is not listed here, it does not exist.',
    fixtures: [
      { name: 'api', type: 'ConduitApiClient', doc: 'Typed API client. Use api.raw.* for negative tests that assert status codes.' },
      { name: 'users', type: 'ActorFactory', doc: 'Creates isolated, authenticated users.' },
      { name: 'articles', type: 'ArticleFactory', doc: 'Creates articles owned by a given actor.' },
      { name: 'actor', type: 'Actor', doc: 'A pre-registered authenticated user for tests that just need "someone".' },
      { name: 'pages', type: '{ home, login, register, editor, article(slug) }', doc: 'Page objects bound to the active page.' },
      { name: 'loginAs', type: '(actor: Actor) => Promise<void>', doc: 'Seeds the JWT into localStorage to skip the login form.' },
    ],
    classes: sortByName(classes),
    functions: sortByName(functions),
    testTags: ['@api', '@ui', '@smoke', '@regression', '@negative', '@known-issue'],
    commands: {
      'npm run agent:verify': 'Run this before declaring any change complete. Lint + typecheck + manifest drift + smoke tests.',
      'npm test': 'Run the whole suite (requires the app under test to be running).',
      'npm run test:api': 'API tests only — fast, no browser.',
      'npm run test:ui': 'UI tests only.',
      'npm run manifest:generate': 'Regenerate this file after changing src/.',
    },
  }
}

function main(): void {
  const manifest = buildManifest()
  const serialised = `${JSON.stringify(manifest, null, 2)}\n`
  const checkMode = process.argv.includes('--check')

  if (!checkMode) {
    fs.writeFileSync(MANIFEST_PATH, serialised)
    console.info(
      `Wrote ${path.relative(REPO_ROOT, MANIFEST_PATH)} ` +
        `(${manifest.classes.length} classes, ${manifest.functions.length} functions).`,
    )
    return
  }

  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error('AGENT_MANIFEST.json is missing. Run: npm run manifest:generate')
    process.exit(1)
  }

  const existing = fs.readFileSync(MANIFEST_PATH, 'utf8')
  if (existing !== serialised) {
    console.error(
      'AGENT_MANIFEST.json is out of date with src/.\n' +
        'The manifest is what an agent reads to discover available helpers, so stale content ' +
        'causes hallucinated method calls.\n' +
        'Fix: npm run manifest:generate && git add AGENT_MANIFEST.json',
    )
    process.exit(1)
  }

  console.info('AGENT_MANIFEST.json is up to date.')
}

main()
