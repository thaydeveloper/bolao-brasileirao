import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

const COOKIE_NAME = "sessao";
const SESSION_DAYS = 30;

function getSecret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-secret");
}

export type Session = { userId: number; isAdmin: boolean };

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(session: Session) {
  const token = await new SignJWT({ isAdmin: session.isAdmin })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(session.userId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    // Secure exige HTTPS. Mantido desligado por padrão para permitir acesso por
    // HTTP na rede local; em deploy com HTTPS (ex.: Vercel), defina COOKIE_SECURE="true".
    secure: process.env.COOKIE_SECURE === "true",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: "/",
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return { userId: Number(payload.sub), isAdmin: Boolean(payload.isAdmin) };
  } catch {
    return null;
  }
}

/** Retorna o usuário logado ou redireciona para /login. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  // Cookie assinado, mas o usuário não existe mais (ex.: banco recriado):
  // encerra a sessão em vez de cair em loop de redirecionamento.
  if (!user) redirect("/api/logout");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/");
  return user;
}
