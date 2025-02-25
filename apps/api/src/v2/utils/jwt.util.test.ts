/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth0JwtDecodedMock } from '../mocks/jwt.mock'

import {
  auth0JwtVerify,
  auth0JwtTestSign,
  JwtFactory,
  jwtRegExp
} from './jwt.util'

import type { SortJWT } from '../types/jwt.type'

describe('v2/utils/jwt.utils', () => {
  const subject = {
    user: {
      id: '123'
    }
  }

  describe('JwtFactory', () => {
    const factory = JwtFactory<{ user: { id: string } }, SortJWT>({
      issuer: 'sort.xyz',
      subject: 'session',
      audience: 'sort.xyz'
    })

    it('creates an object which creates JWTs', () => {
      expect(typeof factory.create).toBe('function')
      expect(typeof factory.verify).toBe('function')
    })

    describe('create()', () => {
      it('should return a JWT signature', () => {
        const signed = factory.create(subject)
        expect(signed).toMatch(jwtRegExp)
      })
    })

    describe('verify()', () => {
      it('returns the expected deserialized data', async () => {
        const signature = factory.create(subject)
        const verified = await factory.verify(signature)
        expect(verified).toEqual({
          ...subject,
          aud: 'sort.xyz',
          iss: 'sort.xyz',
          sub: 'session',
          iat: expect.any(Number),
          exp: verified.iat + 60 * 60 * 24 * 3
        })
      })
    })
  })

  describe('auth0JwtVerify()', () => {
    it('returns the expected deserialized data', async () => {
      const signature = auth0JwtTestSign(auth0JwtDecodedMock)
      const verified = await auth0JwtVerify(signature)
      expect(verified).toEqual({
        ...auth0JwtDecodedMock,
        iat: expect.any(Number)
      })
    })
  })
})
