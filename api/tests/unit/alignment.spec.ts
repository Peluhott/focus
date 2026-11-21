import { test } from '@japa/runner'
import { GeminiProvider } from '#services/alignment/gemini'
import { ProviderError, type AlignmentContext } from '#services/alignment/types'
import { parseVerdict, toOutcome } from '#services/alignment/verdict'

const context: AlignmentContext = {
  goals: [
    {
      id: 1,
      title: 'Get fit',
      details: '',
      sub_goals: [],
      projects: [{ title: 'Race plan', details: '', pending_tasks: ['Book physio'] }],
    },
  ],
  version: 'v1',
}

/** Stub fetch for one Gemini response. */
function stubFetch(status: number, body: unknown) {
  const real = globalThis.fetch
  const seen: { url: string; init: RequestInit }[] = []
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    seen.push({ url, init })
    return new Response(JSON.stringify(body), { status })
  }) as typeof fetch
  return { seen, restore: () => (globalThis.fetch = real) }
}

const geminiAnswer = (verdict: unknown) => ({
  candidates: [{ content: { parts: [{ text: JSON.stringify(verdict) }] }, finishReason: 'STOP' }],
  usageMetadata: { promptTokenCount: 300, candidatesTokenCount: 40, thoughtsTokenCount: 10 },
})

test.group('Alignment verdicts', () => {
  test('the schema rejects malformed verdicts', async ({ assert }) => {
    await assert.rejects(() => parseVerdict({ aligned: 'yes', confidence: 2 }))
    await assert.rejects(() =>
      parseVerdict({
        aligned: true,
        confidence: 0.5,
        match: { type: 'project', id: 1 },
        reason: 'x',
      })
    )
    const ok = await parseVerdict({
      aligned: true,
      confidence: 0.5,
      match: { type: 'goal', id: 1 },
      reason: '  fine  ',
    })
    assert.equal(ok.reason, 'fine')
  })

  test('reasons are cut to 140 characters', ({ assert }) => {
    const outcome = toOutcome(
      {
        aligned: false,
        confidence: 0.9,
        match: { type: 'none', id: null },
        reason: 'x'.repeat(300),
      },
      context
    )
    assert.equal(outcome.status, 'unaligned')
    assert.lengthOf(outcome.reason, 140)
  })

  test('an aligned verdict naming "none" is aligned with no chip', ({ assert }) => {
    const outcome = toOutcome(
      { aligned: true, confidence: 0.9, match: { type: 'none', id: null }, reason: 'ok' },
      context
    )
    assert.deepInclude(outcome, { status: 'aligned', matchedGoalId: null })
  })
})

test.group('Gemini provider', () => {
  test('sends structured-output requests and reads usage', async ({ assert }) => {
    const stub = stubFetch(
      200,
      geminiAnswer({
        aligned: true,
        confidence: 0.9,
        match: { type: 'project', id: 2 },
        reason: 'Yes.',
      })
    )
    try {
      const result = await new GeminiProvider(
        'test-key',
        'gemini-3.1-flash-lite'
      ).classifyAlignment({ title: 'Book the physio', notes: '' }, context)
      assert.deepEqual(result.verdict.match, { type: 'goal', id: 1 })
      assert.deepEqual(result.usage, { inputTokens: 300, outputTokens: 50 })

      const { url, init } = stub.seen[0]
      assert.include(url, 'gemini-3.1-flash-lite:generateContent')
      assert.equal((init.headers as Record<string, string>)['x-goog-api-key'], 'test-key')
      const body = JSON.parse(init.body as string)
      assert.equal(body.generationConfig.responseMimeType, 'application/json')
      assert.include(body.contents[0].parts[0].text, 'Book the physio')
      assert.include(body.contents[0].parts[0].text, 'Race plan')
    } finally {
      stub.restore()
    }
  })

  test('HTTP errors and bad JSON become ProviderErrors', async ({ assert }) => {
    const provider = new GeminiProvider('test-key')
    let stub = stubFetch(503, { error: { message: 'overloaded' } })
    try {
      await assert.rejects(
        () => provider.classifyAlignment({ title: 'x', notes: '' }, context),
        ProviderError as any
      )
    } finally {
      stub.restore()
    }
    stub = stubFetch(200, {
      candidates: [{ content: { parts: [{ text: 'not json' }] } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
    })
    try {
      const error = await provider
        .classifyAlignment({ title: 'x', notes: '' }, context)
        .catch((e) => e)
      assert.instanceOf(error, ProviderError)
      assert.deepEqual(error.usage, { inputTokens: 10, outputTokens: 5 })
    } finally {
      stub.restore()
    }
  })
})
