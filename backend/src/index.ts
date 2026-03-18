import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
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

async function main() {
  await app.register(cors, {
    origin: true,
    credentials: true,
  });
  await app.register(multipart);

  // Initialize DB schema + seed
  initSchema();

  // Purge expired sessions every hour
  setInterval(purgeExpiredSessions, 60 * 60 * 1000);

  // Auth routes (public — no preHandler)
  await app.register(authRoutes);

  // Protected routes
  await app.register(testsRoutes);
  await app.register(runsRoutes);
  await app.register(artifactsRoutes);
  await app.register(authStateRoutes);
  await app.register(settingsRoutes);
  await app.register(codegenRoutes);
  await app.register(usersRoutes);

  // Health check (public)
  app.get("/health", async () => ({ status: "ok" }));

  const port = parseInt(process.env.PORT || "4000", 10);
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`TraceLab backend listening on :${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
