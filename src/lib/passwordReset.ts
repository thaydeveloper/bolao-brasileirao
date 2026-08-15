import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./db";

function getSecret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-secret");
}

const RESET_TTL = "24h"; // link vale 24h

/**
 * Vínculo com o hash atual da senha: quando a senha é trocada, o hash muda e o
 * token deixa de valer — na prática, o link é de USO ÚNICO (e expira em 24h).
 */
function pwBinding(passwordHash: string): string {
  return passwordHash.slice(-12);
}

/** Cria um token assinado de redefinição de senha para o usuário. */
export async function createResetToken(user: { id: number; passwordHash: string }): Promise<string> {
  return new SignJWT({ purpose: "pwreset", pw: pwBinding(user.passwordHash) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(RESET_TTL)
    .sign(getSecret());
}

export type ResetUser = { id: number; name: string };

/** Valida o token e devolve o usuário, ou null se inválido/expirado/já usado. */
export async function verifyResetToken(token: string): Promise<ResetUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.purpose !== "pwreset") return null;
    const user = await prisma.user.findUnique({ where: { id: Number(payload.sub) } });
    if (!user) return null;
    if (payload.pw !== pwBinding(user.passwordHash)) return null; // senha já trocada → link expirado
    return { id: user.id, name: user.name };
  } catch {
    return null;
  }
}
