import { FastifyInstance } from "fastify";
import axios from "axios";
import { requireAuth } from "../auth/middleware";

const RUNNER_URL = process.env.RUNNER_URL || "http://runner:5000";

export async function codegenRoutes(app: FastifyInstance) {
  // Start a codegen session
  app.post("/api/codegen/start", { preHandler: requireAuth }, async (req, reply) => {
    const body = req.body as { url?: string; sessionId?: string };
    try {
      const res = await axios.post(`${RUNNER_URL}/codegen/start`, body);
      return reply.send(res.data);
    } catch (err: any) {
      return reply.status(502).send({ error: err?.response?.data?.error ?? err.message });
    }
  });

  // Finish a codegen session and get the script
  app.post("/api/codegen/finish", { preHandler: requireAuth }, async (req, reply) => {
    const body = req.body as { sessionId: string };
    try {
      const res = await axios.post(`${RUNNER_URL}/codegen/finish`, body);
      return reply.send(res.data);
    } catch (err: any) {
      return reply.status(502).send({ error: err?.response?.data?.error ?? err.message });
    }
  });
}
