# Copula authentication provider setup

Supabase callback URL:

`https://pqykkkpanrqwporfrego.supabase.co/auth/v1/callback`

Production application URL:

`https://web-amber-eight-32.vercel.app`

## Built-in providers

Create a web OAuth application in each provider console, register the Supabase callback URL, and enable the provider in Supabase Authentication > Sign In / Providers.

- Google: client ID and client secret
- Kakao: REST API key and Kakao Login client secret
- Apple: Services ID and generated client secret

The application automatically enables each button after Supabase reports that provider as active.

## Naver

Create a Naver Login application and register the Supabase callback URL. In Supabase, create a custom OAuth2 provider with:

- Identifier: `custom:naver`
- Authorization URL: `https://nid.naver.com/oauth2.0/authorize`
- Token URL: `https://nid.naver.com/oauth2.0/token`
- User info URL: `https://openapi.naver.com/v1/nid/me`

Set the Naver client ID and client secret in the custom provider. The web application maps the Naver button to `custom:naver`.

## Verification

After configuring providers, confirm that the public settings endpoint reports them as enabled:

`https://pqykkkpanrqwporfrego.supabase.co/auth/v1/settings`

Then test sign-in, sign-out, email confirmation, and password recovery on the production URL.
