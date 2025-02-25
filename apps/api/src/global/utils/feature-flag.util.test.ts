import { isFeatureEnabled } from './feature-flag.util'

describe('feature flags', () => {
  afterEach(() => {
    process.env.SORT_FEAT_ENABLE_FOO = ''
  })

  it('exists', () => {
    expect(typeof isFeatureEnabled).toBe('function')
  })

  it('by default, enables everything in test env', () => {
    expect(isFeatureEnabled('something')).toBe(true)
  })

  it('detects when a feature is enabled', () => {
    process.env.SORT_FEAT_ENABLE_FOO = 'true'
    expect(isFeatureEnabled('FOO', false)).toBe(true)
    expect(isFeatureEnabled('SORT_FEAT_ENABLE_FOO', false)).toBe(true)
  })

  it('detects when a feature is disabled', () => {
    expect(isFeatureEnabled('FOO', false)).toBe(false)
    expect(isFeatureEnabled('SORT_FEAT_ENABLE_FOO', false)).toBe(false)
    expect(isFeatureEnabled('something', false)).toBe(false)
  })
})
