import { configApp } from '@adonisjs/eslint-config'

export default configApp(
  {
    rules: {
      // `x == null` is the idiom for "null or undefined".
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },
  {
    // Tests read response bodies inline: (await client.get(...)).body()
    files: ['tests/**/*.ts'],
    rules: { '@unicorn/no-await-expression-member': 'off' },
  }
)
