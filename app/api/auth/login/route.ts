
import { NextRequest, NextResponse } from "next/server";

import {
  createSession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "../../../../lib/auth";

import {
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest
) {
  const headers = {
    "Cache-Control": "no-store",
  };

  try {
    const body = await request.json();

    const email =
      typeof body.email === "string"
        ? body.email.trim()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    const expectedEmail =
      process.env.AUTH_EMAIL?.trim() ?? "";

    const storedHash =
      process.env.AUTH_PASSWORD_HASH ?? "";

    if (
      !expectedEmail ||
      !storedHash ||
      !process.env.AUTH_SECRET
    ) {
      console.error(
        "Variáveis de autenticação ausentes."
      );

      return NextResponse.json(
        { error: "Erro de configuração do servidor." },
        { status: 500, headers }
      );
    }

    const [salt, expectedHash, ...extra] =
      storedHash.split(":");

    if (
      !salt ||
      !expectedHash ||
      extra.length > 0 ||
      !/^[a-f0-9]{128}$/i.test(expectedHash)
    ) {
      console.error(
        "Formato de AUTH_PASSWORD_HASH inválido."
      );

      return NextResponse.json(
        { error: "Erro de configuração do servidor." },
        { status: 500, headers }
      );
    }

    const calculatedHash = scryptSync(
      password,
      salt,
      64
    );

    const savedHash = Buffer.from(
      expectedHash,
      "hex"
    );

    const validPassword =
      savedHash.length === calculatedHash.length &&
      timingSafeEqual(savedHash, calculatedHash);

    const validEmail =
      email.toLowerCase() ===
      expectedEmail.toLowerCase();

    if (!validEmail || !validPassword) {
      return NextResponse.json(
        { error: "E-mail ou senha incorretos." },
        { status: 401, headers }
      );
    }

    const session = await createSession();

    const response = NextResponse.json(
      { success: true },
      { status: 200, headers }
    );

    response.cookies.set(
      SESSION_COOKIE,
      session,
      sessionCookieOptions
    );

    return response;
  } catch {
    return NextResponse.json(
      { error: "Não foi possível realizar o login." },
      { status: 400, headers }
    );
  }
}
