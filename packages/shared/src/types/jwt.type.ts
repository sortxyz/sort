// JWT spec: https://tools.ietf.org/html/rfc7519
export type SortJWT = {
  user: {
    id: string
  }
  aud: string // https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.3
  iss: string // https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.1
  sub: string // https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.2
  iat: number // https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.6
  exp: number // https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.4
  [key: string]: unknown
}

export type Auth0JWT = {
  sub: string
  nickname?: string
  name?: string
  picture?: string
  updated_at?: string
  email?: string
  email_verified?: boolean
  iss?: string
  aud?: string
  iat?: number
  exp?: number
  sid?: string
  [key: string]: unknown
}
