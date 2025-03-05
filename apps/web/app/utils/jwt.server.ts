import * as jwt from "fast-jwt";
import buildJwks from "get-jwks";
import { serverEnv } from "./env.server";

type Auth0JWT = {
  sub: string;
  nickname?: string;
  name?: string;
  picture?: string;
  updated_at?: string;
  email?: string;
  email_verified?: boolean;
  iss?: string;
  aud?: string;
  iat?: number;
  exp?: number;
  sid?: string;
  auth_time?: number;
  [key: string]: unknown;
};

const auth0Jwks = buildJwks({
  max: 100,
  issuersWhitelist:
    serverEnv.SORT_AUTH === "auth0"
      ? [serverEnv.AUTH0_ISSUER_BASE_URL]
      : undefined,
});

const verifier = jwt.createVerifier({
  async key(token, _cb) {
    const publicKey = await auth0Jwks.getPublicKey({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      kid: token.header.kid,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      alg: token.header.alg,
      domain:
        serverEnv.SORT_AUTH === "auth0"
          ? serverEnv.AUTH0_ISSUER_BASE_URL
          : undefined,
    });

    return publicKey;
  },
});

/**
 * Verifies the given string is an Auth0 JWT and returns the deserialized payload.
 * @throws {Error} if token is invalid or expired
 */
export const verifyAuth0JWT = (token: string): Promise<Auth0JWT> =>
  verifier(token);

/**
 * This is used to initialize the user in the Sort API after
 * the user logs in with their hard-coded on-prem credentials.
 */

const SORT_JWT_ALGORITHM = "HS256";
const JWT_SECRET =
  serverEnv.SORT_AUTH === "form" ? serverEnv.SORT_JWT_SECRET : "ignored";

export const JwtFactory = <
  In extends string | Buffer | Record<string, unknown>,
  Out,
>({
  issuer,
  subject,
  audience,
  expiresIn = "1 days",
}: {
  issuer: string;
  subject: string;
  audience: string | string[];
  expiresIn?: string;
}) => {
  const sign = jwt.createSigner({
    key: JWT_SECRET,
    iss: issuer,
    aud: audience,
    sub: subject,
    algorithm: SORT_JWT_ALGORITHM,
    expiresIn,
  });

  const verifier = jwt.createVerifier({
    key: JWT_SECRET,
    allowedIss: issuer,
    allowedAud: audience,
    allowedSub: subject,
    algorithms: [SORT_JWT_ALGORITHM],
  });

  return {
    create(value: In) {
      return sign(value) as unknown as Promise<string>;
    },

    verify(token: string | Buffer): Promise<Out> {
      return verifier(token) as Promise<Out>;
    },
  };
};

export type SortOnPremJWT = {
  user: {
    email: string;
  };
  aud: string; // https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.3
  iss: string; // https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.1
  sub: string; // https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.2
  iat: number; // https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.6
  exp: number; // https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.4
  [key: string]: unknown;
};

export const OnPremAuthJwt = JwtFactory<
  { user: { email: string } },
  SortOnPremJWT
>({
  issuer: "sort.xyz",
  subject: "sort-web-onprem-auth",
  audience: "sort.xyz",
});

// convenience
export const createOnPremAuthJwt = (email: string) =>
  OnPremAuthJwt.create({ user: { email } });
