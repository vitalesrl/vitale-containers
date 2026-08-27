import "dotenv/config";
import Fastify from "fastify";
import { mkdir } from "node:fs/promises";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { productRoutes } from "./routes/products.js";
import { leadRoutes } from "./routes/leads.js";
import { adminRoutes } from "./routes/admin.js";
import { containerRoutes } from "./routes/containers.js";
import { mediaRoutes } from "./routes/media.js";
import { ebayRoutes } from "./routes/ebay.js";
import { localUploadsRoot } from "./lib/media.js";
import { requireAdminAuth } from "./lib/auth.js";

const app = Fastify({ logger: true });
const port = Number(process.env.PORT || 4001);

await mkdir(localUploadsRoot, { recursive: true });
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "http://localhost:4000,http://127.0.0.1:4000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

await app.register(cors, {
  origin: allowedOrigins,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400
});
await app.register(multipart, {
  limits: {
    files: 20,
    fileSize: 12 * 1024 * 1024,
    parts: 25
  }
});
await app.register(fastifyStatic, {
  root: localUploadsRoot,
  prefix: "/uploads/",
  decorateReply: false
});

app.addHook("onRequest", async (request, reply) => {
  if (request.url.startsWith("/api/admin/")) {
    await requireAdminAuth(request, reply);
  }
});

app.get("/health", async () => ({
  ok: true,
  service: "vitale-containers-api",
  port,
  supabaseConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
  mediaStorage: process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "local"
}));
await app.register(productRoutes);
await app.register(containerRoutes);
await app.register(leadRoutes);
await app.register(adminRoutes);
await app.register(mediaRoutes);
await app.register(ebayRoutes);

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
