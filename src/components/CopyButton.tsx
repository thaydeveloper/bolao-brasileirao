"use client";

import { useState } from "react";

export default function CopyButton({ value, label = "Copiar chave" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // fallback para contextos sem clipboard API
      const ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type="button" className="btn btn-sm" onClick={copy}>
      {copied ? "✓ Copiado!" : label}
    </button>
  );
}
