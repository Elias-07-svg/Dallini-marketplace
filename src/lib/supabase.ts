import 'react-native-url-polyfill/auto';
import 'expo-sqlite/localStorage/install';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type PostgrestAuthDiagnosticContext = {
  sessionAccessToken: string;
  validatedUserId: string;
};

export type PostgrestAuthDiagnostic = {
  authorizationPresent: boolean;
  authorizationMatchesSessionJwt: boolean;
  authorizationMatchesPublishableKey: boolean;
  authorizationIsUserSessionJwt: boolean;
  jwtRole: string | null;
  jwtSubjectMatchesValidatedUser: boolean;
  missingDefaultPreferenceRequested: boolean;
  failingPolicyCondition: string;
};

let activePostgrestAuthDiagnostic:
  | {
      context: PostgrestAuthDiagnosticContext;
      result: PostgrestAuthDiagnostic | null;
    }
  | null = null;

export function beginPostgrestAuthDiagnostic(context: PostgrestAuthDiagnosticContext) {
  const active = { context, result: null as PostgrestAuthDiagnostic | null };
  activePostgrestAuthDiagnostic = active;

  return () => {
    if (activePostgrestAuthDiagnostic === active) activePostgrestAuthDiagnostic = null;
    return active.result;
  };
}

function decodeJwtClaims(token: string) {
  const payload = token.split('.')[1];
  if (!payload) return null;

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const base64 = payload.replace(/-/gu, '+').replace(/_/gu, '/').replace(/=+$/u, '');
  let buffer = 0;
  let bitCount = 0;
  let decoded = '';

  for (const character of base64) {
    const value = alphabet.indexOf(character);
    if (value < 0) return null;
    buffer = (buffer << 6) | value;
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      decoded += String.fromCharCode((buffer >> bitCount) & 0xff);
      buffer &= (1 << bitCount) - 1;
    }
  }

  try {
    const claims: unknown = JSON.parse(decoded);
    return typeof claims === 'object' && claims !== null
      ? (claims as { role?: unknown; sub?: unknown })
      : null;
  } catch {
    return null;
  }
}

function diagnosePolicyCondition(
  jwtRole: string | null,
  jwtSubjectMatchesValidatedUser: boolean,
  authorizationMatchesPublishableKey: boolean,
  missingDefaultPreferenceRequested: boolean,
) {
  if (authorizationMatchesPublishableKey || jwtRole !== 'authenticated') {
    return 'policy role must be authenticated';
  }
  if (!jwtSubjectMatchesValidatedUser) {
    return 'customer_id = auth.uid()';
  }
  if (!missingDefaultPreferenceRequested) return "status = 'draft'";
  return 'no inspected WITH CHECK condition is false';
}

function createDiagnosticFetch(publishableKey: string): typeof fetch {
  const networkFetch = globalThis.fetch.bind(globalThis);

  return async (input, init) => {
    if (!__DEV__) return networkFetch(input, init);

    const requestUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const requestMethod =
      init?.method ??
      (typeof input === 'string' || input instanceof URL ? 'GET' : input.method ?? 'GET');
    const active = activePostgrestAuthDiagnostic;
    let isRequestInsert = false;
    if (__DEV__ && active && requestMethod.toUpperCase() === 'POST') {
      try {
        isRequestInsert = new URL(requestUrl).pathname.endsWith('/rest/v1/requests');
      } catch {
        isRequestInsert = false;
      }
    }

    let authorization = '';
    let bearerToken = '';
    let missingDefaultPreferenceRequested = false;
    if (isRequestInsert) {
      const requestHeaders = new Headers(
        init?.headers ??
          (typeof input === 'string' || input instanceof URL ? undefined : input.headers),
      );
      authorization = requestHeaders.get('authorization') ?? '';
      bearerToken = /^Bearer\s+(.+)$/iu.exec(authorization)?.[1] ?? '';
      missingDefaultPreferenceRequested = (requestHeaders.get('prefer') ?? '')
        .split(',')
        .some((preference) => preference.trim().toLowerCase() === 'missing=default');
    }

    const response = await networkFetch(input, init);

    if (isRequestInsert && active && !response.ok) {
      const claims = bearerToken ? decodeJwtClaims(bearerToken) : null;
      const jwtRole = typeof claims?.role === 'string' ? claims.role : null;
      const jwtSubjectMatchesValidatedUser =
        typeof claims?.sub === 'string' && claims.sub === active.context.validatedUserId;
      const authorizationMatchesPublishableKey =
        Boolean(bearerToken) && bearerToken === publishableKey;
      const result: PostgrestAuthDiagnostic = {
        authorizationPresent: Boolean(authorization),
        authorizationMatchesSessionJwt:
          Boolean(bearerToken) && bearerToken === active.context.sessionAccessToken,
        authorizationMatchesPublishableKey,
        authorizationIsUserSessionJwt:
          !authorizationMatchesPublishableKey &&
          jwtRole === 'authenticated' &&
          jwtSubjectMatchesValidatedUser,
        jwtRole,
        jwtSubjectMatchesValidatedUser,
        missingDefaultPreferenceRequested,
        failingPolicyCondition: diagnosePolicyCondition(
          jwtRole,
          jwtSubjectMatchesValidatedUser,
          authorizationMatchesPublishableKey,
          missingDefaultPreferenceRequested,
        ),
      };
      active.result = result;
    }

    return response;
  };
}

const projectUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';

let parsedProjectUrl: URL | null = null;
try {
  if (projectUrl) parsedProjectUrl = new URL(projectUrl);
} catch {
  parsedProjectUrl = null;
}

export type SupabaseConfigurationIssue =
  | 'missing-url'
  | 'missing-key'
  | 'invalid-url'
  | 'invalid-key'
  | 'unsupported-host';

function isLocalNetworkHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    return true;
  }
  if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) {
    return true;
  }

  const octets = host.split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }

  const [first, second] = octets;
  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  );
}

function isHostedSupabaseUrl(url: URL) {
  const host = url.hostname.toLowerCase();
  const projectRef = host.endsWith('.supabase.co')
    ? host.slice(0, -'.supabase.co'.length)
    : '';

  return (
    url.protocol === 'https:' &&
    /^[a-z0-9-]+$/u.test(projectRef) &&
    !url.username &&
    !url.password &&
    !url.port &&
    url.pathname === '/' &&
    !url.search &&
    !url.hash
  );
}

const configurationIssue: SupabaseConfigurationIssue | null =
  !projectUrl
    ? 'missing-url'
    : !publishableKey
      ? 'missing-key'
      : !parsedProjectUrl || !['http:', 'https:'].includes(parsedProjectUrl.protocol)
        ? 'invalid-url'
        : !publishableKey.startsWith('sb_publishable_')
          ? 'invalid-key'
          : !isLocalNetworkHost(parsedProjectUrl.hostname) && !isHostedSupabaseUrl(parsedProjectUrl)
            ? 'unsupported-host'
            : null;

const loopbackHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '::1']);

export const supabaseConfiguration = {
  issue: configurationIssue,
  isReady: configurationIssue === null,
  usesLoopbackAddress: parsedProjectUrl
    ? loopbackHosts.has(parsedProjectUrl.hostname.toLowerCase())
    : false,
};

export const supabase: SupabaseClient | null =
  configurationIssue === null
    ? createClient(projectUrl, publishableKey, {
        global: { fetch: createDiagnosticFetch(publishableKey) },
        auth: {
          storage: globalThis.localStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;
