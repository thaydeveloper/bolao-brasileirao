"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";

export type FormState = { error?: string; ok?: string } | undefined;

const DEFAULT_GROUP_NAME = "Bolão Brasileirão";

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const pixKey = String(formData.get("pixKey") ?? "").trim();
  const pixKeyType = String(formData.get("pixKeyType") ?? "").trim();
  const photoUrl = String(formData.get("photoUrl") ?? "").trim();

  if (!name || !email || !password) {
    return { error: "Preencha nome, email e senha." };
  }
  if (password.length < 6) {
    return { error: "A senha deve ter pelo menos 6 caracteres." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Já existe uma conta com este email." };
  }

  // Grupo fechado do MVP: um único bolão com limite de 8 participantes
  let group = await prisma.group.findFirst({ where: { name: DEFAULT_GROUP_NAME } });
  if (!group) {
    group = await prisma.group.create({ data: { name: DEFAULT_GROUP_NAME, maxMembers: 8 } });
  }
  const memberCount = await prisma.groupMember.count({ where: { groupId: group.id } });
  if (memberCount >= group.maxMembers) {
    return { error: `O bolão já está completo (${group.maxMembers} participantes).` };
  }

  const userCount = await prisma.user.count();
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      pixKey: pixKey || null,
      pixKeyType: pixKeyType || null,
      photoUrl: photoUrl || null,
      isAdmin: userCount === 0, // o primeiro usuário cadastrado é o administrador
      memberships: { create: { groupId: group.id } },
    },
  });

  await createSession({ userId: user.id, isAdmin: user.isAdmin });
  redirect("/");
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Email ou senha incorretos." };
  }

  await createSession({ userId: user.id, isAdmin: user.isAdmin });
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
