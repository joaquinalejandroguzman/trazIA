// Tipos para el endpoint de health check del backend

export interface HealthCheckResponse {
  status: "ok";
  service: "trazia-backend";
}
