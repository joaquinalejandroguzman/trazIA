// Router Express para el endpoint GET /health

import { Router, Request, Response } from "express";
import { HealthCheckResponse } from "../types/health";

const healthRouter = Router();

// Responde con el estado del servicio
healthRouter.get("/health", (_req: Request, res: Response) => {
  const cuerpo: HealthCheckResponse = {
    status: "ok",
    service: "trazia-backend",
  };
  res.status(200).json(cuerpo);
});

export { healthRouter };
