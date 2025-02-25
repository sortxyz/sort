import { auth0JwtTestSign, SortHubJwt } from '../utils/jwt.util'

export const auth0JwtDecodedMock = {
  sub: 'auth0|64add1c91d395800db1601ba',
  nickname: 'test-user',
  name: 'test-user@sort.xyz',
  picture:
    'https://s.gravatar.com/avatar/3d2334d326099e29dc273a0cf8bdec1b?s=480&r=pg&d=https%3A%2F%2Fcdn.auth0.com%2Favatars%2Fte.png',
  updated_at: '2023-08-01T00:09:35.118Z',
  email: 'test-user@sort.xyz',
  email_verified: false
}

export const auth0JwtMock = auth0JwtTestSign(auth0JwtDecodedMock)

export const sortJwtDecodedMock = {
  user: { id: 'Riju' }
}

export const sortJwtMock = SortHubJwt.create(sortJwtDecodedMock)
