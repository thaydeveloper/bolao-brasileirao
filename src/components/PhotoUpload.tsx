"use client";

import { useRef, useState } from "react";

/**
 * Upload de foto de perfil. Ao clicar, abre o seletor de arquivos; a imagem é
 * redimensionada e comprimida no navegador (máx. 256px, JPEG) e guardada como
 * data URL num input escondido — que o formulário envia no campo `photoUrl`.
 * Assim não é preciso storage externo: a imagem final é pequena (~30–60 KB).
 */
function resizeImage(file: File, maxSize: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height >= width && height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas indisponível"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("imagem inválida"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("falha ao ler o arquivo"));
    reader.readAsDataURL(file);
  });
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

type Props = {
  name?: string;
  defaultValue?: string;
  label?: string;
  personName?: string;
};

export default function PhotoUpload({
  name = "photoUrl",
  defaultValue = "",
  label = "Foto (opcional)",
  personName = "",
}: Props) {
  const [value, setValue] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("Selecione um arquivo de imagem.");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await resizeImage(file, 256, 0.85);
      setValue(dataUrl);
    } catch {
      setError("Não foi possível processar a imagem.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field">
      <label>{label}</label>
      <div
        className="photo-upload"
        role="button"
        tabIndex={0}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileRef.current?.click();
          }
        }}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Foto de perfil" className="photo-preview" />
        ) : (
          <span className="photo-placeholder">{personName ? initials(personName) : "📷"}</span>
        )}
        <span className="photo-hint">
          {busy ? "Processando..." : value ? "Clique para trocar a foto" : "Clique para enviar uma foto"}
        </span>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => onPick(e.target.files?.[0])}
      />
      <input type="hidden" name={name} value={value} />

      {value && (
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          style={{ marginTop: 8 }}
          onClick={() => setValue("")}
        >
          Remover foto
        </button>
      )}
      {error && <div className="form-error" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}
