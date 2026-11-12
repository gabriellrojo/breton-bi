"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        setError("E-mail ou senha inválidos.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#eae5d6",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          padding: "44px 36px",
          borderRadius: 14,
          boxShadow: "0 14px 50px rgba(40,20,25,.09)",
        }}
      >
        <div
          style={{
            color: "#7e2a43",
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: "-1px",
            marginBottom: 8,
          }}
        >
          BRETON
        </div>

        <div
          style={{
            color: "#7e2a43",
            fontSize: 12,
            letterSpacing: 3,
            textTransform: "uppercase",
            marginBottom: 38,
          }}
        >
          Intelligence
        </div>

        <h1
          style={{
            fontSize: 24,
            color: "#292929",
            marginBottom: 8,
          }}
        >
          Bem-vindo
        </h1>

        <p
          style={{
            color: "#777",
            fontSize: 14,
            marginBottom: 28,
            lineHeight: 1.6,
          }}
        >
          Acesse os indicadores de desempenho da Breton.
        </p>

        <form onSubmit={handleSubmit}>
          <label
            htmlFor="email"
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            E-mail
          </label>

          <input
            id="email"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: 13,
              border: "1px solid #d9d3d0",
              borderRadius: 7,
              marginBottom: 22,
              fontSize: 14,
            }}
          />

          <label
            htmlFor="password"
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Senha
          </label>

          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: 13,
              border: "1px solid #d9d3d0",
              borderRadius: 7,
              marginBottom: 20,
              fontSize: 14,
            }}
          />

          {error && (
            <p
              role="alert"
              style={{
                color: "#b42318",
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: 15,
              background: "#7e2a43",
              color: "#fff",
              border: 0,
              borderRadius: 7,
              fontSize: 14,
              fontWeight: 700,
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p
          style={{
            marginTop: 32,
            textAlign: "center",
            color: "#999",
            fontSize: 12,
          }}
        >
          Breton Intelligence · Acesso restrito
        </p>
      </div>
    </main>
  );
}