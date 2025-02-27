import { OAuth2Strategy } from "remix-auth-oauth2";
import type { Strategy } from "remix-auth/strategy";
export interface ConstructorOptions {
  domain: string;
  clientId: string;
  clientSecret: string;
  redirectURI: string;
}

export class Auth0Strategy<User> extends OAuth2Strategy<User> {
  name = "auth0";
  constructor(
    options: ConstructorOptions,
    verify: Strategy.VerifyFunction<User, OAuth2Strategy.VerifyOptions>,
  ) {
    super(
      {
        authorizationEndpoint: `https://${options.domain}/authorize`,
        tokenEndpoint: `https://${options.domain}/oauth/token`,
        tokenRevocationEndpoint: `https://${options.domain}/oauth/revoke`,
        clientId: options.clientId,
        clientSecret: options.clientSecret,
        redirectURI: options.redirectURI,
        scopes: ["openid", "profile", "email"],
      },
      verify,
    );
  }

  override authorizationParams(params: URLSearchParams, request: Request) {
    const url = new URL(request.url);
    if (url.searchParams.size) {
      for (const [key, value] of url.searchParams) {
        params.set(key, value);
      }
    }
    return super.authorizationParams(params, request);
  }
}
