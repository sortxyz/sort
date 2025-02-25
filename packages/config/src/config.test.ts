import { Type } from '@sinclair/typebox'
import { TransformDecodeCheckError } from '@sinclair/typebox/value'

import * as config from './config'

describe('config pkg', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('#configure()', () => {
    it('should return config', () => {
      const schema = Type.Object({
        TZ: Type.String(),
        LOG_LEVEL: Type.String(),
        SORT_FEAT_ENABLE_CHANGE_REQUESTS: Type.Boolean(),
        SORT_FEAT_ENABLE_BONK: Type.Boolean(),
        MAILGUN_API_KEY: Type.String(),
        ENV: Type.String(),
        APP_VERSION: Type.String(),
        IS_PROD_ENV: Type.Boolean(),
        IS_TEST_ENV: Type.Boolean(),
        PI: Type.Number(),
        NULL: Type.Null(),
        NOT_PRESENT: Type.Optional(Type.String())
      })

      const c = config.configure({ directory: './', schema })
      expect(c).toEqual(
        expect.objectContaining({
          TZ: 'UTC',
          ENV: 'test',
          LOG_LEVEL: 'info',
          SORT_FEAT_ENABLE_CHANGE_REQUESTS: false,
          SORT_FEAT_ENABLE_BONK: true,
          MAILGUN_API_KEY: 'fake-value',
          PI: 3.1417,
          NULL: null,
          APP_VERSION: '@sort/config@1.0.0',
          IS_PROD_ENV: false,
          IS_TEST_ENV: true
        })
      )
    })

    it('throws when on invalid env configuration', () => {
      const schema = Type.Object({
        TZ: Type.String(),
        LOG_LEVEL: Type.String(),
        SORT_FEAT_ENABLE_CHANGE_REQUESTS: Type.Boolean(),
        SORT_FEAT_ENABLE_BONK: Type.Boolean(),
        MAILGUN_API_KEY: Type.String(),
        ENV: Type.String(),
        APP_VERSION: Type.String(),
        IS_PROD_ENV: Type.Boolean(),
        IS_TEST_ENV: Type.Boolean(),
        PI: Type.Number(),
        NULL: Type.Null(),
        NOT_PRESENT: Type.String()
      })

      try {
        config.configure({ directory: './', schema })
        fail('should have thrown')
      } catch (err) {
        const e = err as TransformDecodeCheckError
        expect(e.message).toMatch(/Unable to decode value/)
        expect(e.error).toEqual(
          expect.objectContaining({
            path: '/NOT_PRESENT',
            message: 'Expected required property'
          })
        )
      }
    })

    it('applies defaults', () => {
      const schema = Type.Object({
        TZ: Type.String(),
        LOG_LEVEL: Type.String(),
        SORT_FEAT_ENABLE_CHANGE_REQUESTS: Type.Boolean(),
        SORT_FEAT_ENABLE_BONK: Type.Boolean(),
        MAILGUN_API_KEY: Type.String(),
        ENV: Type.String(),
        APP_VERSION: Type.String(),
        IS_PROD_ENV: Type.Boolean(),
        IS_TEST_ENV: Type.Boolean(),
        PI: Type.Number(),
        NULL: Type.Null(),
        X: Type.String({ default: 'dlroW olleH' })
      })

      const c = config.configure({ directory: './', schema })
      expect(c).toEqual(
        expect.objectContaining({
          TZ: 'UTC',
          ENV: 'test',
          LOG_LEVEL: 'info',
          SORT_FEAT_ENABLE_CHANGE_REQUESTS: false,
          SORT_FEAT_ENABLE_BONK: true,
          MAILGUN_API_KEY: 'fake-value',
          PI: 3.1417,
          NULL: null,
          APP_VERSION: '@sort/config@1.0.0',
          IS_PROD_ENV: false,
          IS_TEST_ENV: true,
          X: 'dlroW olleH'
        })
      )
    })

    it('supports postEnvLoad', () => {
      const schema = Type.Object({
        TZ: Type.String(),
        LOG_LEVEL: Type.String(),
        SORT_FEAT_ENABLE_CHANGE_REQUESTS: Type.Boolean(),
        SORT_FEAT_ENABLE_BONK: Type.Boolean(),
        MAILGUN_API_KEY: Type.String(),
        ENV: Type.String(),
        APP_VERSION: Type.String(),
        IS_PROD_ENV: Type.Boolean(),
        IS_TEST_ENV: Type.Boolean(),
        PI: Type.Number(),
        NULL: Type.Null(),
        NOT_PRESENT: Type.String()
      })

      const c = config.configure({
        directory: './',
        schema,
        postEnvLoad: (env: Record<string, unknown>) => {
          if (!env.NOT_PRESENT && env.IS_TEST_ENV) {
            env.NOT_PRESENT = 'my-default-value'
          }
        }
      })
      expect(c).toEqual(
        expect.objectContaining({
          TZ: 'UTC',
          ENV: 'test',
          LOG_LEVEL: 'info',
          SORT_FEAT_ENABLE_CHANGE_REQUESTS: false,
          SORT_FEAT_ENABLE_BONK: true,
          MAILGUN_API_KEY: 'fake-value',
          PI: 3.1417,
          NULL: null,
          APP_VERSION: '@sort/config@1.0.0',
          IS_PROD_ENV: false,
          IS_TEST_ENV: true,
          NOT_PRESENT: 'my-default-value'
        })
      )
    })
  })

  describe('#getConfig', () => {
    it('is set to the last configure() result', () => {
      const schema = Type.Object({
        TZ: Type.String(),
        LOG_LEVEL: Type.String(),
        SORT_FEAT_ENABLE_CHANGE_REQUESTS: Type.Boolean(),
        SORT_FEAT_ENABLE_BONK: Type.Boolean(),
        MAILGUN_API_KEY: Type.String(),
        ENV: Type.String(),
        APP_VERSION: Type.String(),
        IS_PROD_ENV: Type.Boolean(),
        IS_TEST_ENV: Type.Boolean(),
        PI: Type.Number(),
        NULL: Type.Null(),
        NOT_PRESENT: Type.Optional(Type.String())
      })

      const c = config.configure({ directory: './', schema })
      expect(c).toEqual(config.getConfig())
    })
  })
})
