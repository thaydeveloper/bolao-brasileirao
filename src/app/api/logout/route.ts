import { NextResponse, type NextRequest } from "next/server";

/**
 * Encerra a sessão de forma segura: apaga o cookie e volta para o login.
 * Usado tanto pelo botão "Sair" quanto pela recuperação de sessão inválida
 * (cookie assinado, mas cujo usuário não existe mais no banco) — evitando
 * o loop de redirecionamento entre o middleware e o requireUser().
 */
export async function GET(request: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", request.url));
  res.cookies.delete("sessao");
  return res;
}
