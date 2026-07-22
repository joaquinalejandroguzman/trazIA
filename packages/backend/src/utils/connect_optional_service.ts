// Utilidad para conectar servicios externos opcionales durante el arranque.
// Si falla, registra el error en stderr y continúa — no detiene el servidor.

export async function connectOptionalService(
  serviceName: string,
  url: string,
  connectFn: () => Promise<void>
): Promise<void> {
  try {
    await connectFn();
  } catch (error) {
    // Registrar en stderr con contexto completo, sin relanzar
    console.error(
      JSON.stringify({
        agente: "backend",
        módulo: "startup",
        servicio: serviceName,
        url,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
}
