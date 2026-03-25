import Fastify from "fastify";
import cors from "@fastify/cors";
import { initSchema } from "./db/schema";
import { testsRoutes } from "./routes/tests";
import { runsRoutes } from "./routes/runs";
import { artifactsRoutes } from "./routes/artifacts";
import { authStateRoutes } from "./routes/auth-state";
import { settingsRoutes } from "./routes/settings";
import { codegenRoutes } from "./routes/codegen";
import { authRoutes } from "./routes/auth";
import { usersRoutes } from "./routes/users";
import { testSharesRoutes } from "./routes/test-shares";
import { chainLinksRoutes } from "./routes/chain-links";
import { schedulesRoutes } from "./routes/schedules";
import { purgeExpiredSessions } from "./auth/session";
import { initScheduler } from "./scheduler/index";

const app = Fastify({ logger: true });

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Build the set of allowed origins: always include both localhost and 127.0.0.1 variants
function buildAllowedOrigins(frontendUrl: string): string[] {
  const origins = new Set([frontendUrl]);
  try {
    const u = new URL(frontendUrl);
    if (u.hostname === "localhost") {
      origins.add(`${u.protocol}//127.0.0.1:${u.port || (u.protocol === "https:" ? 443 : 80)}`);
    } else if (u.hostname === "127.0.0.1") {
      origins.add(`${u.protocol}//localhost:${u.port || (u.protocol === "https:" ? 443 : 80)}`);
    }
  } catch {}
  return [...origins];
}

const ALLOWED_ORIGINS = buildAllowedOrigins(FRONTEND_URL);

async function main() {
  await app.register(cors, {
    origin: ALLOWED_ORIGINS,
    credentials: true,
  });
  // Initialize DB schema + seed
  initSchema();

  // Purge expired sessions every hour
  setInterval(purgeExpiredSessions, 60 * 60 * 1000);

  // Start cron scheduler
  initScheduler();

  // CSRF: reject state-changing requests from unexpected origins
  // Requests without Origin (server-to-server proxy) are allowed
  app.addHook("preValidation", async (req, reply) => {
    if (!["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) return;
    const origin = req.headers.origin;
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      app.log.warn({ origin, url: req.url, ip: req.ip, event: "csrf_blocked" }, "CSRF check failed");
      return reply.status(403).send({ error: "Forbidden" });
    }
  });

  // Auth routes (public)
  await app.register(authRoutes);

  // Protected routes
  await app.register(testsRoutes);
  await app.register(runsRoutes);
  await app.register(artifactsRoutes);
  await app.register(authStateRoutes);
  await app.register(settingsRoutes);
  await app.register(codegenRoutes);
  await app.register(usersRoutes);
  await app.register(testSharesRoutes);
  await app.register(chainLinksRoutes);
  await app.register(schedulesRoutes);

  const port = parseInt(process.env.PORT || "4000", 10);
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`TraceLab backend listening on :${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
