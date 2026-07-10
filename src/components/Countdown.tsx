"use client";

import { useEffect, useState } from "react";

function format(ms: number): string {
  if (ms <= 0) return "Começou!";
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d}d ${h}h ${m}min`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min ${String(s).padStart(2, "0")}s`;
  return `${m}min ${String(s).padStart(2, "0")}s`;
}

export default function Countdown({ target }: { target: string }) {
  const [text, setText] = useState<string>("...");

  useEffect(() => {
    const targetMs = new Date(target).getTime();
    const tick = () => setText(format(targetMs - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  return <span className="countdown">{text}</span>;
}
