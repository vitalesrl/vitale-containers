import type { FastifyReply, FastifyRequest } from "fastify";
import { getSupabaseAdmin } from "./supabase.js";

function bearerToken(request: FastifyRequest) {
  const header = request.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

export async function requireAdminAuth(request: FastifyRequest, reply: FastifyReply) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return reply.code(503).send({ error: "Autenticazione non configurata sul server." });
  }

  const token = bearerToken(request);
  if (!token) {
    return reply.code(401).send({ error: "Accesso non autorizzato." });
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return reply.code(401).send({ error: "Sessione scaduta o non valida." });
  }
}
