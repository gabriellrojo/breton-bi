
import type { NextRequest } from "next/server";

export const SESSION_COOKIE = "breton_bi_session";

const SESSION_SECONDS = 60 * 30;

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET deve ter pelo menos 32 caracteres."
    );
  }

  return secret;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign", "verify"]
  );
}

async function sign(payload: string): Promise<string> {
  const signature = await crypto.subtle.sign(
    "HMAC",
    await getKey(),
    new TextEncoder().encode(payload)
  );

  return base64Url(new Uint8Array(signature));
}

export async function createSession(): Promise<string> {
  const expires =
    Math.floor(Date.now() / 1000) + SESSION_SECONDS;

  const payload = `v1.${expires}`;
  const signature = await sign(payload);

  return `${payload}.${signature}`;
}

export async function isAuthenticated(
  request: NextRequest
): Promise<boolean> {
  try {
    const cookie = request.cookies.get(
      SESSION_COOKIE
    )?.value;

    if (!cookie) return false;

    const parts = cookie.split(".");

    if (
      parts.length !== 3 ||
      parts[0] !== "v1"
    ) {
      return false;
    }

    const expires = Number(parts[1]);

    if (
      !Number.isSafeInteger(expires) ||
      expires <= Math.floor(Date.now() / 1000)
    ) {
      return false;
    }

    const signature = parts[2];

    if (!/^[A-Za-z0-9_-]{43}$/.test(signature)) {
      return false;
    }

    const encoded = signature
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const binary = atob(encoded + "=");

    const signatureBytes = Uint8Array.from(
      binary,
      (char) => char.charCodeAt(0)
    );

    return crypto.subtle.verify(
      "HMAC",
      await getKey(),
      signatureBytes,
      new TextEncoder().encode(
        `${parts[0]}.${parts[1]}`
      )
    );
  } catch {
    return false;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_SECONDS,
};
