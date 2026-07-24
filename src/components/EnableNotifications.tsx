"use client";

import { useEffect, useState } from "react";
import { subscribePushAction, unsubscribePushAction } from "@/app/actions/push";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

type Status = "loading" | "unsupported" | "denied" | "off" | "on" | "working";

export default function EnableNotifications() {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then(async (sub) => {
        if (sub) {
          // Re-sincroniza a inscrição com o servidor (idempotente). Cobre o caso de
          // o navegador ter a inscrição mas o servidor tê-la perdido / nunca recebido
          // (falha na 1ª ativação), comum em aparelhos com restrição agressiva.
          await subscribePushAction(sub.toJSON() as any).catch(() => {});
          setStatus("on");
        } else {
          setStatus("off");
        }
      })
      .catch(() => setStatus("off"));
  }, []);

  async function enable() {
    setError("");
    setStatus("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        });
      }
      const res = await subscribePushAction(sub.toJSON() as any);
      if (!res.ok) {
        setError(res.error ?? "Falha ao ativar.");
        setStatus("off");
        return;
      }
      setStatus("on");
    } catch (e: any) {
      const hint = e?.name ? ` (${e.name})` : "";
      setError(
        `Não foi possível ativar as notificações neste dispositivo${hint}. ` +
          "Em celulares Xiaomi/HyperOS, abra o app pelo Chrome (não pelo navegador da Xiaomi) e tente de novo."
      );
      setStatus("off");
    }
  }

  async function disable() {
    setStatus("working");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribePushAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
    } catch {
      setStatus("on");
    }
  }

  if (status === "loading") return null;

  if (status === "unsupported") {
    return (
      <p className="muted">
        📵 Este dispositivo/navegador não suporta notificações. No iPhone, primeiro adicione o app
        à tela de início (via Safari) e abra por lá. No Android (Xiaomi/HyperOS), use o{" "}
        <strong>Chrome</strong> — o navegador padrão da Xiaomi pode não suportar push.
      </p>
    );
  }

  if (status === "denied") {
    return (
      <p className="muted">
        🔕 As notificações estão bloqueadas nas configurações do navegador. Libere-as para este site
        e recarregue a página.
      </p>
    );
  }

  return (
    <div>
      {status === "on" ? (
        <>
          <p className="form-success" style={{ marginBottom: 10 }}>
            🔔 Notificações ativadas neste dispositivo.
          </p>
          <p className="muted" style={{ marginBottom: 10 }}>
            Não está recebendo no celular? Toque em <strong>Registrar novamente</strong> e confira nos
            ajustes do celular se o Chrome pode enviar notificações e está sem restrição de bateria.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-sm" onClick={enable}>
              🔄 Registrar novamente
            </button>
            <button className="btn btn-secondary btn-sm" onClick={disable}>
              Desativar
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted" style={{ marginBottom: 10 }}>
            Receba avisos (lembretes de palpite, resultados, recado do campeão) direto na tela do
            celular, mesmo com o app fechado.
          </p>
          <button className="btn" onClick={enable} disabled={status === "working"}>
            {status === "working" ? "Ativando..." : "🔔 Ativar notificações"}
          </button>
        </>
      )}
      {error && <div className="form-error" style={{ marginTop: 10 }}>{error}</div>}
    </div>
  );
}
