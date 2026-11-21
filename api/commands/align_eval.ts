import { readFile } from 'node:fs/promises'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import aiConfig from '#config/ai'

type EvalFile = {
  passRate: number
  context: { goals: any[] }
  cases: { title: string; notes?: string; expect: 'aligned' | 'flagged'; match?: string[] }[]
}

/**
 * Runs the labelled eval set (evals/alignment.json) against the model and
 * exits non-zero below the pass rate. Re-run whenever the prompt or model
 * changes. Calls the model directly; nothing is written to the database.
 *
 *   node ace align:eval [--model=gemini-3.5-flash-lite]
 */
export default class AlignEval extends BaseCommand {
  static commandName = 'align:eval'
  static description = 'Run the AI alignment eval set against the model'
  static options: CommandOptions = { startApp: true }

  @flags.string({ description: 'Model to evaluate (defaults to AI_MODEL)' })
  declare model?: string

  async run() {
    if (!aiConfig.apiKey) {
      this.logger.error('GEMINI_API_KEY is not set.')
      this.exitCode = 1
      return
    }
    const { GeminiProvider } = await import('#services/alignment/gemini')
    const { sha256 } = await import('#services/alignment/context')
    const { toOutcome } = await import('#services/alignment/verdict')
    const { PRICES_PER_MTOK, FALLBACK_PRICE } = await import('#config/ai')

    const file: EvalFile = JSON.parse(
      await readFile(new URL('../evals/alignment.json', import.meta.url), 'utf8')
    )
    const context = { ...file.context, version: sha256(file.context) }
    const provider = new GeminiProvider(aiConfig.apiKey, this.model ?? aiConfig.model)

    let passed = 0
    let input = 0
    let output = 0
    for (const c of file.cases) {
      try {
        const { verdict, usage } = await provider.classifyAlignment(
          { title: c.title, notes: c.notes ?? '' },
          context
        )
        input += usage.inputTokens
        output += usage.outputTokens
        const outcome = toOutcome(verdict, context)
        const shown = outcome.status === 'unaligned' ? 'flagged' : 'aligned'
        const chip = outcome.matchedGoalId ? `goal:${outcome.matchedGoalId}` : null
        const ok =
          shown === c.expect && (c.expect === 'flagged' || !c.match || c.match.includes(chip!))
        if (ok) passed++
        const mark = ok ? this.colors.green('✓') : this.colors.red('✗')
        const detail = `${shown}${chip ? ` → ${chip}` : ''} (${verdict.confidence.toFixed(2)})`
        this.logger.log(`${mark} ${c.title}: ${detail}${ok ? '' : `, want ${c.expect}`}`)
        if (!ok) this.logger.log(this.colors.dim(`    ${verdict.reason}`))
      } catch (error) {
        this.logger.log(`${this.colors.red('✗')} ${c.title}: ${(error as Error).message}`)
      }
    }

    const rate = passed / file.cases.length
    const price = PRICES_PER_MTOK[provider.model] ?? FALLBACK_PRICE
    const cost = (input * price.input + output * price.output) / 1e6
    const summary = `${passed}/${file.cases.length} passed (${Math.round(rate * 100)}%, need ${Math.round(file.passRate * 100)}%) on ${provider.model}, ~$${cost.toFixed(4)}`
    if (rate >= file.passRate) {
      this.logger.success(summary)
    } else {
      this.logger.error(summary)
      this.exitCode = 1
    }
  }
}
