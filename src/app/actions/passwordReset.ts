"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin, hashPassword, createSession } from "@/lib/auth";
import { createResetToken, verifyResetToken } from "@/lib/passwordReset";
import type { FormState } from "./auth";

/**
 * (Admin) Gera um link de redefinição de senha para um participante. O admin copia
 * e envia para a pessoa (WhatsApp etc.). O link vale 24h e é de uso único.
 */
export async function generateResetLinkAction(
  userId: number
): Promise<{ link?: string; error?: string }> {
  await requireAdmin();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, passwordHash: true },
  });
  if (!user) return { error: "Participante não encontrado." };

  const token = await createResetToken(user);
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return { link: `${proto}://${host}/redefinir-senha/${token}` };
}

/**
 * (Público, via link) Define a nova senha a partir de um token válido e já loga a
 * pessoa. Token inválido/expirado/já usado é recusado.
 */
export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const user = await verifyResetToken(token);
  if (!user) return { error: "Link inválido ou expirado. Peça um novo link ao admin do bolão." };
  if (password.length < 6) return { error: "A senha deve ter pelo menos 6 caracteres." };
  if (password !== confirm) return { error: "As senhas não conferem." };

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password) },
  });

  const updated = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isAdmin: true },
  });
  await createSession({ userId: user.id, isAdmin: Boolean(updated?.isAdmin) });
  redirect("/");
}
