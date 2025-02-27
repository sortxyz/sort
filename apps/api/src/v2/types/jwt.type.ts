// JWT spec: https://tools.ietf.org/html/rfc7519

// Used for SortWeb -> API communication
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

// Used for email verification
export type EmailVerificationJWT = {
  user: { id: string; email: string }
  aud: string
  iss: string
  sub: string
  iat: number
  exp: number
  [key: string]: unknown
}

// Used for SortWeb Auth0 -> User authentication and set up
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

// Used for SortWeb OnPrem -> User authentication and set up
export type SortOnPremJWT = {
  user: {
    email: string
  }
  aud: string // https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.3
  iss: string // https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.1
  sub: string // https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.2
  iat: number // https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.6
  exp: number // https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.4
  [key: string]: unknown
}
