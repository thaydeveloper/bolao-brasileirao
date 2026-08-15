"use client";

import { useState } from "react";
import { generateResetLinkAction } from "@/app/actions/passwordReset";

/** (Admin) Gera um link de redefinição de senha para o participante e permite copiar. */
export default function AdminResetLink({ userId }: { userId: number }) {
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setLoading(true);
    setError("");
    setCopied(false);
    try {
      const res = await generateResetLinkAction(userId);
      if (res.link) setLink(res.link);
      else setError(res.error ?? "Falha ao gerar o link.");
    } catch {
      setError("Falha ao gerar o link.");
    }
    setLoading(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* usuário pode copiar manualmente do campo */
    }
  }

  return (
    <div style={{ textAlign: "left" }}>
      <button className="btn btn-sm btn-secondary" onClick={generate} disabled={loading}>
        {loading ? "Gerando..." : "🔑 Link de senha"}
      </button>
      {error && (
        <div className="form-error" style={{ marginTop: 6 }}>
          {error}
        </div>
      )}
      {link && (
        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            style={{ width: "100%", fontSize: "0.78rem" }}
          />
          <button className="btn btn-sm" onClick={copy}>
            {copied ? "Copiado ✓" : "Copiar link"}
          </button>
          <span className="muted" style={{ fontSize: "0.75rem" }}>
            Válido por 24h e de uso único. Envie para a pessoa.
          </span>
        </div>
      )}
    </div>
  );
}
