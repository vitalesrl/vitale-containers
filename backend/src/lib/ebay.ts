import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual
} from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "./supabase.js";

export type EbayEnvironment = "sandbox" | "production";

type EbayTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  token_type: string;
};

type EbayConnectionRow = {
  environment: EbayEnvironment;
  refresh_token_encrypted: string;
  refresh_token_expires_at: string | null;
  scopes: string[] | null;
  connected_at: string;
  updated_at: string;
};

type CachedAccessToken = {
  value: string;
  expiresAt: number;
};

const EBAY_SCOPES = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/sell.inventory"
];

const accessTokenCache = new Map<EbayEnvironment, CachedAccessToken>();

export class EbayConfigurationError extends Error {}

export class EbayApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function getEbayEnvironment(): EbayEnvironment {
  return process.env.EBAY_ENVIRONMENT?.toLowerCase() === "production"
    ? "production"
    : "sandbox";
}

function ebayConfig() {
  const environment = getEbayEnvironment();
  const clientId = process.env.EBAY_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.EBAY_CLIENT_SECRET?.trim() ?? "";
  const ruName = process.env.EBAY_RUNAME?.trim() ?? "";
  const tokenSecret = process.env.EBAY_TOKEN_SECRET?.trim() ?? "";
  const stateSecret = process.env.EBAY_STATE_SECRET?.trim() || tokenSecret;

  const missing = [
    ["EBAY_CLIENT_ID", clientId],
    ["EBAY_CLIENT_SECRET", clientSecret],
    ["EBAY_RUNAME", ruName],
    ["EBAY_TOKEN_SECRET", tokenSecret]
  ].filter(([, value]) => !value).map(([name]) => name);

  return {
    environment,
    clientId,
    clientSecret,
    ruName,
    tokenSecret,
    stateSecret,
    missing,
    apiBase: environment === "production"
      ? "https://api.ebay.com"
      : "https://api.sandbox.ebay.com",
    authBase: environment === "production"
      ? "https://auth.ebay.com"
      : "https://auth.sandbox.ebay.com"
  };
}

function requireEbayConfig() {
  const config = ebayConfig();
  if (config.missing.length > 0) {
    throw new EbayConfigurationError(
      `Configurazione eBay incompleta: ${config.missing.join(", ")}`
    );
  }
  if (config.tokenSecret.length < 32) {
    throw new EbayConfigurationError(
      "EBAY_TOKEN_SECRET deve contenere almeno 32 caratteri."
    );
  }
  return config;
}

function requireSupabase() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new EbayConfigurationError(
      "Supabase non configurato: la connessione eBay richiede persistenza sicura."
    );
  }
  return supabase;
}

function encryptionKey(secret: string) {
  return createHash("sha256").update(secret).digest();
}

function encryptToken(value: string, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

function decryptToken(value: string, secret: string) {
  const [ivText, tagText, encryptedText] = value.split(".");
  if (!ivText || !tagText || !encryptedText) {
    throw new EbayConfigurationError("Token eBay cifrato non valido.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(secret),
    Buffer.from(ivText, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

function oauthBasic(clientId: string, clientSecret: string) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64")}`;
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function errorMessage(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") return fallback;
  const object = data as Record<string, unknown>;
  if (typeof object.error_description === "string") return object.error_description;
  if (typeof object.message === "string") return object.message;
  const errors = object.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    return errors.map((item) => {
      if (!item || typeof item !== "object") return String(item);
      const error = item as Record<string, unknown>;
      const message = typeof error.message === "string" ? error.message : "Errore eBay";
      const detail = Array.isArray(error.parameters)
        ? error.parameters.map((parameter) => {
            if (!parameter || typeof parameter !== "object") return "";
            const value = (parameter as Record<string, unknown>).value;
            return typeof value === "string" ? value : "";
          }).filter(Boolean).join(" · ")
        : "";
      return detail ? `${message}: ${detail}` : message;
    }).join(" | ");
  }
  return fallback;
}

function createOAuthState(secret: string) {
  const issuedAt = Date.now().toString();
  const nonce = randomBytes(18).toString("base64url");
  const payload = `${issuedAt}.${nonce}`;
  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyEbayOAuthState(state: string) {
  const config = requireEbayConfig();
  const [issuedAt, nonce, signature] = state.split(".");
  if (!issuedAt || !nonce || !signature) return false;
  const timestamp = Number(issuedAt);
  if (!Number.isFinite(timestamp) || Date.now() - timestamp > 10 * 60 * 1000) {
    return false;
  }
  const expected = createHmac("sha256", config.stateSecret)
    .update(`${issuedAt}.${nonce}`)
    .digest();
  const received = Buffer.from(signature, "base64url");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function getEbayAuthorizationUrl() {
  const config = requireEbayConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.ruName,
    response_type: "code",
    scope: EBAY_SCOPES.join(" "),
    state: createOAuthState(config.stateSecret),
    locale: "it-IT",
    prompt: "login"
  });
  return `${config.authBase}/oauth2/authorize?${params.toString()}`;
}

async function tokenRequest(body: URLSearchParams) {
  const config = requireEbayConfig();
  const response = await fetch(`${config.apiBase}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: oauthBasic(config.clientId, config.clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body
  });
  const data = await parseResponse(response);
  if (!response.ok) {
    throw new EbayApiError(
      errorMessage(data, "Autorizzazione eBay non riuscita."),
      response.status,
      data
    );
  }
  return data as EbayTokenResponse;
}

async function saveConnection(token: EbayTokenResponse) {
  const config = requireEbayConfig();
  const supabase = requireSupabase();
  if (!token.refresh_token) {
    throw new EbayApiError("eBay non ha restituito il refresh token.", 502, token);
  }
  const now = new Date();
  const refreshExpiresAt = token.refresh_token_expires_in
    ? new Date(now.getTime() + token.refresh_token_expires_in * 1000).toISOString()
    : null;
  const { error } = await supabase.from("ebay_connections").upsert({
    environment: config.environment,
    refresh_token_encrypted: encryptToken(token.refresh_token, config.tokenSecret),
    refresh_token_expires_at: refreshExpiresAt,
    scopes: EBAY_SCOPES,
    connected_at: now.toISOString(),
    updated_at: now.toISOString()
  }, { onConflict: "environment" });
  if (error) {
    throw new EbayConfigurationError(
      `Salvataggio connessione eBay non riuscito: ${error.message}`
    );
  }
  accessTokenCache.set(config.environment, {
    value: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000
  });
}

export async function exchangeEbayAuthorizationCode(code: string) {
  const config = requireEbayConfig();
  const token = await tokenRequest(new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.ruName
  }));
  await saveConnection(token);
}

async function getConnection(
  supabase: SupabaseClient,
  environment: EbayEnvironment
) {
  const { data, error } = await supabase
    .from("ebay_connections")
    .select("*")
    .eq("environment", environment)
    .maybeSingle();
  if (error) throw error;
  return data as EbayConnectionRow | null;
}

async function refreshAccessToken() {
  const config = requireEbayConfig();
  const connection = await getConnection(requireSupabase(), config.environment);
  if (!connection) {
    throw new EbayConfigurationError("Account eBay non collegato.");
  }
  const token = await tokenRequest(new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: decryptToken(
      connection.refresh_token_encrypted,
      config.tokenSecret
    ),
    scope: EBAY_SCOPES.join(" ")
  }));
  accessTokenCache.set(config.environment, {
    value: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000
  });
  return token.access_token;
}

async function userAccessToken(forceRefresh = false) {
  const environment = getEbayEnvironment();
  const cached = accessTokenCache.get(environment);
  if (!forceRefresh && cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.value;
  }
  return refreshAccessToken();
}

async function ebayRequestOnce<T>(
  path: string,
  accessToken: string,
  init: RequestInit
) {
  const config = requireEbayConfig();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Accept", "application/json");
  headers.set("Accept-Language", "it-IT");
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${config.apiBase}${path}`, {
    ...init,
    headers
  });
  const data = await parseResponse(response);
  return { response, data: data as T };
}

export async function ebayRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  let result = await ebayRequestOnce<T>(path, await userAccessToken(), init);
  if (result.response.status === 401) {
    result = await ebayRequestOnce<T>(
      path,
      await userAccessToken(true),
      init
    );
  }
  if (!result.response.ok) {
    throw new EbayApiError(
      errorMessage(result.data, `Richiesta eBay non riuscita (${result.response.status}).`),
      result.response.status,
      result.data
    );
  }
  return result.data;
}

export async function disconnectEbay() {
  const config = requireEbayConfig();
  const supabase = requireSupabase();
  const connection = await getConnection(supabase, config.environment);
  if (connection) {
    try {
      await fetch(`${config.apiBase}/identity/v1/oauth2/token/revoke`, {
        method: "POST",
        headers: {
          Authorization: oauthBasic(config.clientId, config.clientSecret),
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          token: decryptToken(
            connection.refresh_token_encrypted,
            config.tokenSecret
          ),
          token_type_hint: "refresh_token"
        })
      });
    } catch {
      // La rimozione locale prosegue anche se eBay non risponde alla revoca.
    }
  }
  const { error } = await supabase
    .from("ebay_connections")
    .delete()
    .eq("environment", config.environment);
  if (error) throw new EbayConfigurationError(error.message);
  accessTokenCache.delete(config.environment);
}

export async function getEbayConnectionStatus() {
  const config = ebayConfig();
  const status = {
    environment: config.environment,
    credentialsConfigured: config.missing.length === 0,
    missingConfiguration: config.missing,
    databaseReady: false,
    connected: false,
    connectedAt: null as string | null,
    refreshTokenExpiresAt: null as string | null
  };
  const supabase = getSupabaseAdmin();
  if (!supabase) return status;
  try {
    const connection = await getConnection(supabase, config.environment);
    status.databaseReady = true;
    status.connected = Boolean(connection);
    status.connectedAt = connection?.connected_at ?? null;
    status.refreshTokenExpiresAt = connection?.refresh_token_expires_at ?? null;
  } catch {
    // La migrazione eBay non è stata ancora eseguita.
  }
  return status;
}

export function ebayFrontendUrl(path = "/admin/marketplace") {
  const origin = (process.env.FRONTEND_ORIGIN || "http://localhost:4000")
    .split(",")[0]
    .trim()
    .replace(/\/$/, "");
  return `${origin}${path}`;
}

export const ebayScopes = EBAY_SCOPES.slice();
