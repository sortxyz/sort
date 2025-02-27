import * as jwt from 'fast-jwt'
import buildJwks from 'get-jwks'

import { config } from '../../config/bootstrap'

import type {
  Auth0JWT,
  EmailVerificationJWT,
  SortJWT,
  SortOnPremJWT
} from '../types/jwt.type'

const { IS_TEST_ENV } = config

const SORT_JWT_SECRET = config.SORT_JWT_SECRET
const AUTH0_TEST_SECRET = 'CharlesPetrescu'
const AUTH0_ISSUER_BASE_URL = config.AUTH0_ISSUER_BASE_URL ?? ''
const SORT_JWT_ALGORITHM = 'HS256'

const auth0JwtTestSigner = jwt.createSigner({
  key: AUTH0_TEST_SECRET,
  algorithm: 'HS256'
})

const auth0Jwks = buildJwks({
  max: IS_TEST_ENV ? 1 : 100,
  issuersWhitelist: [AUTH0_ISSUER_BASE_URL]
})

const auth0JwtVerifierKey = async (token: jwt.DecodedJwt) => {
  if (IS_TEST_ENV) return AUTH0_TEST_SECRET

  const publicKey = await auth0Jwks.getPublicKey({
    kid: token.header.kid,
    alg: token.header.alg,
    domain: AUTH0_ISSUER_BASE_URL
  })

  return publicKey
}

const auth0JwtVerifier = jwt.createVerifier({
  key: auth0JwtVerifierKey
})

/**
 * Verifies the given string is an Auth0 JWT and returns the deserialized payload.
 * @throws {Error} if token is invalid or expired
 */
export const auth0JwtVerify = (token: string | Buffer): Promise<Auth0JWT> =>
  auth0JwtVerifier(token)

/**
 * For testing purposes only.
 */
export const auth0JwtTestSign = auth0JwtTestSigner

/**
 * A RegExp which matches the JWT string format.
 */
export const jwtRegExp = /^[a-zA-Z0-9]+\.[a-zA-Z0-9]+\.[a-zA-Z0-9_-]+$/

export const JwtFactory = <
  In extends string | Buffer | Record<string, unknown>,
  Out
>({
  issuer,
  subject,
  audience,
  expiresIn = '3 days'
}: {
  issuer: string
  subject: string
  audience: string | string[]
  expiresIn?: string
}) => {
  const sign = jwt.createSigner({
    key: SORT_JWT_SECRET,
    iss: issuer,
    aud: audience,
    sub: subject,
    algorithm: SORT_JWT_ALGORITHM,
    expiresIn
  })

  // @ts-expect-error fast-jwt types are wrong: https://github.com/nearform/fast-jwt/pull/546
  const verify = jwt.createVerifier({
    key: SORT_JWT_SECRET,
    allowedIss: issuer,
    allowedAud: audience,
    allowedSub: subject,
    algorithms: [SORT_JWT_ALGORITHM],
    cache: 500,
    cacheKeyBuilder: (k: string) => k
  })

  return {
    create(value: In) {
      return sign(value)
    },

    verify(token: string | Buffer): Promise<Out> {
      return verify(token)
    }
  }
}

export const SortWebJwt = JwtFactory<{ user: { id: string } }, SortJWT>({
  issuer: 'sort.xyz',
  subject: 'session',
  audience: 'sort.xyz'
})

// convenience
export const createSortJwt = (id: string) => SortWebJwt.create({ user: { id } })

export const EmailVerificationJwt = JwtFactory<
  { user: { id: string; email: string } },
  EmailVerificationJWT
>({
  issuer: 'sort.xyz',
  subject: 'email-verification',
  audience: 'sort.xyz'
})

export const SortWebOnPremJwt = JwtFactory<
  { user: { email: string } },
  SortOnPremJWT
>({
  issuer: 'sort.xyz',
  subject: 'sortweb-onprem-auth',
  audience: 'sort.xyz'
})
