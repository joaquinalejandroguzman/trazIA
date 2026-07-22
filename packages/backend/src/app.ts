// Punto de entrada del servidor Express.
// Exporta `app` (para testing) y `startServer` (para uso programático).
// El servidor arranca automáticamente solo cuando este archivo es el módulo de entrada.

import http from "http";
import express, { Express } from "express";
import { healthRouter } from "./routes/health";

// Crear y configurar la aplicación Express
const app: Express = express();

app.use(express.json());

// Montar rutas
app.use("/", healthRouter);

// Función para arrancar el servidor en un puerto dado
function startServer(port: number): http.Server {
  const server = app.listen(port, () => {
    console.log(
      JSON.stringify({
        agente: "backend",
        módulo: "startup",
        mensaje: `Servidor escuchando en el puerto ${port}`,
      })
    );
  });
  return server;
}

// Arrancar solo cuando es el módulo de entrada
if (require.main === module) {
  const PORT = parseInt(process.env.PORT ?? "3001", 10);
  startServer(PORT);
}

export { app, startServer };
