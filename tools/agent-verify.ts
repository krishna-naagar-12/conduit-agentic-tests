/**
 * The one command an agent (or human) runs before declaring work complete.
 *
 *   npm run agent:verify
 *
 * Why a single command: an agent that has to remember four separate commands will
 * run one of them, see green, and stop. Bundling the gates into one entry point
 * with a clear pass/fail summary makes "did I break anything?" a single decision.
 *
 * Gates run cheapest-first so feedback arrives fast:
 *   1. typecheck  — catches invented methods and wrong argument types
 *   2. lint       — catches sleeps, raw locators, hardcoded data, weak assertions
 *   3. manifest   — catches src/ changes that were not published to the manifest
 *   4. smoke      — proves the suite still executes against the real app
 *
 * The smoke gate is skipped (not failed) when the app under test is unreachable,
 * so the static gates remain useful without a running app.
 */

import { spawnSync } from 'node:child_process'

interface Gate {
  name: string
  description: string
  command: string
  args: string[]
  /** When true, a failure is reported but does not fail the overall run. */
  optional?: boolean
}

const GATES: Gate[] = [
  {
    name: 'typecheck',
    description: 'TypeScript compilation (catches calls to helpers that do not exist)',
    command: 'npx',
    args: ['tsc', '--noEmit'],
  },
  {
    name: 'lint',
    description: 'Agent guardrails (no sleeps, no raw locators, no hardcoded data, no weak assertions)',
    command: 'npx',
    args: ['eslint', '.', '--ext', '.ts'],
  },
  {
    name: 'manifest',
    description: 'AGENT_MANIFEST.json matches src/',
    command: 'npx',
    args: ['ts-node', '--transpileOnly', 'tools/generate-manifest.ts', '--check'],
  },
  {
    name: 'smoke',
    description: 'Smoke tests against the running app',
    command: 'npx',
    args: ['playwright', 'test', '--grep', '@smoke'],
    optional: true,
  },
]

function run(gate: Gate): { passed: boolean; output: string } {
  const result = spawnSync(gate.command, gate.args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  return { passed: result.status === 0, output }
}

function main(): void {
  console.info('Running agent verification gates\n')

  const failures: string[] = []
  const warnings: string[] = []

  for (const gate of GATES) {
    process.stdout.write(`  [${gate.name}] ${gate.description} ... `)
    const { passed, output } = run(gate)

    if (passed) {
      console.info('PASS')
      continue
    }

    if (gate.optional) {
      console.info('SKIPPED / FAILED (non-blocking)')
      warnings.push(`${gate.name}:\n${output.trim()}`)
      continue
    }

    console.info('FAIL')
    failures.push(`${gate.name}:\n${output.trim()}`)
  }

  if (warnings.length > 0) {
    console.info('\n--- Non-blocking warnings ---')
    for (const warning of warnings) {
      console.info(`\n${warning}\n`)
    }
    console.info(
      'If the smoke gate failed because the app is not running, start it with `npm run dev` ' +
        'in the app-under-test directory and re-run.',
    )
  }

  if (failures.length > 0) {
    console.error('\n--- Blocking failures ---')
    for (const failure of failures) {
      console.error(`\n${failure}\n`)
    }
    console.error(
      `\n${failures.length} gate(s) failed. Fix these before considering the change complete.`,
    )
    process.exit(1)
  }

  console.info('\nAll blocking gates passed.')
}

main()
