"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import type { FormState } from "./auth";

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  const pixKey = String(formData.get("pixKey") ?? "").trim();
  const pixKeyType = String(formData.get("pixKeyType") ?? "").trim();
  const photoUrl = String(formData.get("photoUrl") ?? "").trim();

  if (!name) return { error: "O nome é obrigatório." };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name,
      pixKey: pixKey || null,
      pixKeyType: pixKeyType || null,
      photoUrl: photoUrl || null,
    },
  });

  revalidatePath("/perfil");
  return {};
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");

  if (!(await verifyPassword(current, user.passwordHash))) {
    return { error: "Senha atual incorreta." };
  }
  if (next.length < 6) {
    return { error: "A nova senha deve ter pelo menos 6 caracteres." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next) },
  });

  return {};
}
