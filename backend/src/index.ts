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
import { purgeExpiredSessions } from "./auth/session";

const app = Fastify({ logger: true });

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

async function main() {
  await app.register(cors, {
    origin: [FRONTEND_URL],
    credentials: true,
  });
  // Initialize DB schema + seed
  initSchema();

  // Purge expired sessions every hour
  setInterval(purgeExpiredSessions, 60 * 60 * 1000);

  // CSRF: reject state-changing requests from unexpected origins
  // Requests without Origin (server-to-server proxy) are allowed
  app.addHook("preValidation", async (req, reply) => {
    if (!["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) return;
    const origin = req.headers.origin;
    if (origin && origin !== FRONTEND_URL) {
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

  const port = parseInt(process.env.PORT || "4000", 10);
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`TraceLab backend listening on :${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
