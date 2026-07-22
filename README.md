# TrazIA

*Hackathon Código Facilito x AWS Kiro — Reto 🟨 Productividad y herramientas para desarrolladores*

> Nombre placeholder — cambiar si surge algo mejor.

## Una línea

Pegás la URL de un repo (o lo arrastrás) y en segundos ves un mapa interactivo de tu arquitectura, coloreado según qué partes tienen trazabilidad de intención real y cuáles son una caja negra — con un click, un agente te genera ahí mismo la spec que falta. Funciona igual en código vibecodeado sin proceso o hardcodeado a mano sin documentar.

## El problema

El código se acumula más rápido de lo que se documenta — sea porque se generó con IA sin spec previa, o porque un dev lo escribió a mano hace años sin dejar rastro de por qué existe. En ambos casos el síntoma es el mismo: nadie sabe qué partes del repo se entienden y cuáles son deuda invisible, hasta que se rompe algo o entra alguien nuevo al equipo.

## La solución — cómo funciona

1. **Carga:** URL de GitHub (MVP) o carpeta local. Análisis estático, sin necesidad de ejecutar el proyecto.
2. **Pipeline de agentes (corren como funciones Lambda que llaman a Bedrock directo — el producto en uso real, no solo dentro del IDE de Kiro):**
   - **Agente Analizador** — mapea módulos, dependencias y estructura real del código
   - **Agente Redactor EARS** — infiere, para cada módulo, qué requisito cumple probablemente (leyendo código, nombres, comentarios y mensajes de commit — sin asumir origen IA ni código reciente) y redacta un `requirements.md` retroactivo
   - **Agente Orquestador** — calcula el **Spec Health Score** por módulo y a nivel proyecto
3. **Visualización:** grafo interactivo, color por estado —
   - 🟢 trazado
   - 🟡 drift (spec desactualizada respecto al código)
   - 🔴 sin trazabilidad de intención
4. **Interacción:** click en un nodo rojo → el agente genera la spec faltante en vivo, en sintaxis EARS, lista para guardarse en `.kiro/specs/`.

## Uso de Kiro (lo que el jurado evalúa)

El producto final *es* la estructura de Kiro generada y visualizada — no es decorativo. Usa specs (EARS), y el output se guarda directo en `.kiro/specs/` del repo analizado.

## Uso de AWS

Nos dieron **$100 USD de crédito AWS por persona** para el hackathon (aparte de los créditos de Kiro) — **$200 en total entre los dos**, cada uno en su propia cuenta. Con eso, integramos **Bedrock directo** en el producto — separando dos cosas:

- **Kiro** = cómo construimos el proyecto (spec-driven development, todo versionado en `.kiro/`) — sigue siendo el corazón del pitch de "uso de Kiro".
- **Bedrock** = lo que el producto usa en tiempo de ejecución para razonar. Los 3 agentes (Analizador, Redactor EARS, Orquestador) corren como funciones Lambda que llaman a Claude vía Bedrock — esto demuestra integración real de AWS en el producto funcionando, no solo en el proceso de desarrollo.

Servicios:

- **Bedrock** — Claude (Haiku para el Analizador, más barato y mecánico; Sonnet para el Redactor EARS, que necesita mejor razonamiento) — dentro del crédito de $100
- **Lambda** — expone cada agente como función serverless (Always Free: 1M invocaciones/mes)
- **DynamoDB** — histórico del Spec Health Score entre commits (Always Free: 25GB + capacidad de lectura/escritura)
- **S3** — hosting del frontend (free tier de 12 meses para cuentas nuevas — verificar antigüedad de la cuenta antes de depender de esto en la demo)

**Presupuesto:** decidir **una sola cuenta AWS "principal"** donde vive el producto desplegado (Lambda, DynamoDB, S3, Bedrock) — mezclar recursos entre las dos cuentas complica el IAM sin necesidad. La otra cuenta queda como backup/testing individual antes de integrar. En la cuenta principal, setear una AWS Budget alert en ~$20-30 para no arriesgarse a quemar crédito sin darse cuenta durante testing. El rol de "Gobernador" del equipo revisa esto cada día.

## Alcance del MVP — lo único que se compromete a terminar en 5 días

- Un solo stack: **TypeScript/JavaScript**
- Solo input por URL de GitHub (sin drag-folder ni auth compleja)
- Grafo estático (carpetas + imports) — sin trazas de runtime
- Analizador + Redactor EARS + Spec Health Score funcionando de punta a punta

**Stretch goals (solo si van adelantados, día 4+):** drift-checker contra specs existentes, generador de steering (product.md/tech.md/structure.md), soporte multi-lenguaje, edición de spec antes de guardar.

## Equipo (2 personas, trabajo remoto)

- **Persona A** → Agente Analizador + Agente Orquestador (Spec Health Score)
- **Persona B** → Agente Redactor EARS + integración con el grafo (usar librería de grafos ya armada tipo react-flow, no programar layout desde cero, para no perder tiempo en frontend)

## Plan de 5 días (remoto)

**Día 1 — juntos**
Diseñan arquitectura y specs en Kiro entre los dos (`requirements.md`, `design.md`, contrato de datos JSON entre agentes). Usar VS Code Live Share (compatible con Kiro) para editar en simultáneo. Definir ramas de git antes de separarse. Salir de la llamada con el contrato de datos commiteado, no solo hablado.

**Días 2-3 — separados, cada uno dueño de un agente completo**
Check-in de 15 min al arrancar cada día (no al final) para compensar la falta de comunicación de pasillo del remoto.

**Día 4 — se cruzan**
Cada uno revisa y mejora el agente del otro (`/pr-review` agéntico: usar Kiro para validar el código del compañero contra la spec). Puede ser async vía PR de GitHub o en llamada.

**Día 5 — juntos**
Integración final. Grabar un video de respaldo del demo funcionando por si falla la conexión en la presentación en vivo. Ensayar el pitch completo por videollamada al menos una vez, decidiendo quién habla en cada parte.

## Guion de demo (3 min)

1. **0:00–0:30** — Hook: mostrar un repo real feo (uno viejo hardcodeado) — "¿quién entiende esto en 5 minutos?"
2. **0:30–1:15** — Pegar la URL en vivo, ver el grafo renderizarse con colores
3. **1:15–1:45** — Repetir con un segundo repo vibecodeado reciente, mismo resultado — prueba de que funciona con cualquier origen de código
4. **1:45–2:30** — Click en un nodo rojo → generar la spec en vivo, en EARS
5. **2:30–2:50** — Mostrar el Spec Health Score subir, mencionar DynamoDB/S3 por debajo
6. **2:50–3:00** — Cierre: visión de equipo (trackear salud del repo en el tiempo)

## Riesgos a vigilar

- **Scope creep** — grafo + pipeline multiagente es ambicioso para 2 personas en 5 días. Checkpoint día 3: si el grafo no está resuelto, bajar a lista/árbol coloreado antes de sacrificar el motor de specs.
- **Que se sienta "solo un linter con grafo lindo"** — en el pitch, narrar el razonamiento del agente (por qué infirió ese requirement), no solo mostrar el resultado.
- **Precisión en código dinámico/legacy** — validar el repo de demo varias veces antes de la presentación para que no falle en vivo.
