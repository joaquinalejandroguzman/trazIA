# Requirements Document

## Introduction

Esta feature mejora el comportamiento responsivo del layout principal de TrazIA. El objetivo es que los paneles laterales (izquierdo y derecho) y el chat flotante funcionen con un sistema de toggle explícito, optimizando el espacio disponible para el grafo interactivo. El panel izquierdo se oculta por defecto con un botón para desplegarlo, el panel derecho (ModulePanel) ocupa toda la pantalla al abrirse, y el chat tiene su propio toggle en la esquina inferior izquierda con reglas de visibilidad dependientes del estado de los paneles.

## Glossary

- **Panel_Izquierdo**: Barra lateral izquierda (`app__sidebar`) que contiene el ProjectSummary y GraphLegend. Actualmente siempre visible.
- **Panel_Derecho**: Panel de detalle de nodos (`ModulePanel`) que se despliega a la derecha al seleccionar un nodo en el grafo.
- **Chat**: Panel flotante de chat contextual (`ChatPanel`) que permite al usuario interactuar con TrazIA sobre el proyecto analizado.
- **Botón_Toggle_Izquierdo**: Botón fijo en la parte superior de la pantalla que controla la visibilidad del Panel_Izquierdo.
- **Botón_Toggle_Chat**: Botón fijo en la esquina inferior izquierda de la pantalla que controla la visibilidad del Chat.
- **Vista_Completa**: Estado del Panel_Derecho donde ocupa el 100% del área principal, ocultando el Panel_Izquierdo, el Chat y todos los botones toggle.
- **Área_Principal**: Zona del layout debajo del header que contiene el grafo, paneles y chat (`app__main`).
- **Sistema_Layout**: Componente de orquestación del layout principal de la aplicación (App.tsx y App.css).

## Requirements

### Requirement 1: Panel Izquierdo oculto por defecto

**User Story:** Como usuario, quiero que el panel izquierdo esté oculto por defecto, para que el grafo disponga de la máxima área visible al cargar la aplicación.

#### Acceptance Criteria

1. WHEN el dashboard se renderiza por primera vez, THE Sistema_Layout SHALL ocultar el Panel_Izquierdo y mostrar únicamente el Área_Principal con el grafo ocupando el 100% del ancho disponible del contenedor principal (sin columna de sidebar en el grid).
2. WHILE el Panel_Derecho no está en Vista_Completa, THE Sistema_Layout SHALL mostrar el Botón_Toggle_Izquierdo en posición fija dentro del Área_Principal, en la esquina superior izquierda, a 8px del borde izquierdo y 8px del borde superior del contenedor del grafo.
3. WHEN el usuario presiona el Botón_Toggle_Izquierdo estando el Panel_Izquierdo oculto, THE Sistema_Layout SHALL desplegar el Panel_Izquierdo con una transición animada de duración entre 200ms y 300ms.
4. WHEN el usuario presiona el Botón_Toggle_Izquierdo estando el Panel_Izquierdo visible, THE Sistema_Layout SHALL ocultar el Panel_Izquierdo con una transición animada de duración entre 200ms y 300ms.
5. WHILE el Panel_Izquierdo está visible, THE Sistema_Layout SHALL asignar al Panel_Izquierdo un ancho de 280px y reducir el ancho del grafo en la misma medida, sin solapamiento entre panel y grafo.
6. THE Botón_Toggle_Izquierdo SHALL ser activable mediante teclado (focusable y accionable con Enter o Espacio) y presentar un atributo aria-expanded que refleje el estado actual del Panel_Izquierdo (true si visible, false si oculto).

### Requirement 2: Panel Derecho en Vista Completa

**User Story:** Como usuario, quiero que el panel de detalle de nodo ocupe toda la pantalla al abrirse, para poder inspeccionar los detalles sin distracciones visuales.

#### Acceptance Criteria

1. WHEN el usuario selecciona un nodo y el Panel_Derecho se abre, THE Sistema_Layout SHALL expandir el Panel_Derecho para que ocupe el 100% del ancho y alto del Área_Principal, superponiéndose completamente al grafo.
2. WHEN el Panel_Derecho entra en Vista_Completa, THE Sistema_Layout SHALL ocultar el Panel_Izquierdo independientemente de su estado anterior.
3. WHEN el Panel_Derecho entra en Vista_Completa, THE Sistema_Layout SHALL ocultar el Chat independientemente de su estado anterior.
4. WHEN el Panel_Derecho entra en Vista_Completa, THE Sistema_Layout SHALL ocultar el Botón_Toggle_Izquierdo y el Botón_Toggle_Chat.
5. WHEN el usuario cierra el Panel_Derecho, THE Sistema_Layout SHALL restaurar la visibilidad del Botón_Toggle_Izquierdo y del Botón_Toggle_Chat.
6. WHEN el usuario cierra el Panel_Derecho, THE Sistema_Layout SHALL restaurar el estado previo del Panel_Izquierdo (si estaba abierto antes de la Vista_Completa, se reabre; si estaba cerrado, permanece cerrado).
7. WHEN el usuario cierra el Panel_Derecho, THE Sistema_Layout SHALL restaurar el estado previo del Chat (si estaba abierto antes de la Vista_Completa, se reabre; si estaba cerrado, permanece cerrado).
8. THE Panel_Derecho SHALL incluir un botón de cierre visible con aria-label "Cerrar panel" que permita al usuario volver al estado normal del layout, operable mediante teclado (Enter y Space).
9. WHEN el usuario navega a otro nodo desde dentro del Panel_Derecho en Vista_Completa, THE Sistema_Layout SHALL mantener el Panel_Derecho en Vista_Completa y actualizar su contenido con los detalles del nuevo nodo seleccionado.

### Requirement 3: Botón Toggle del Chat

**User Story:** Como usuario, quiero tener un botón toggle para el chat en la esquina inferior izquierda, para poder abrir y cerrar el chat a voluntad sin que interfiera con los paneles.

#### Acceptance Criteria

1. THE Sistema_Layout SHALL posicionar el Botón_Toggle_Chat en la esquina inferior izquierda de la pantalla con posición fija.
2. WHEN el usuario presiona el Botón_Toggle_Chat estando el Chat cerrado, THE Chat SHALL desplegarse con una animación suave desde la esquina inferior izquierda.
3. WHEN el usuario presiona el Botón_Toggle_Chat estando el Chat abierto, THE Chat SHALL cerrarse con una animación suave.
4. WHILE el Panel_Derecho está en Vista_Completa, THE Sistema_Layout SHALL ocultar el Botón_Toggle_Chat y el Chat sin alterar el estado interno del Chat (abierto o cerrado).
5. WHILE el Panel_Izquierdo está visible, THE Sistema_Layout SHALL ocultar el Botón_Toggle_Chat y el Chat sin alterar el estado interno del Chat (abierto o cerrado).
6. WHEN el Panel_Izquierdo se cierra y el Panel_Derecho no está en Vista_Completa, THE Sistema_Layout SHALL restaurar la visibilidad del Botón_Toggle_Chat y, si el Chat estaba abierto antes de ser ocultado, restaurar el Chat a su estado abierto.
7. WHEN el dashboard se renderiza por primera vez, THE Chat SHALL estar cerrado y el Botón_Toggle_Chat SHALL estar visible (siempre que el Panel_Izquierdo no esté visible y el Panel_Derecho no esté en Vista_Completa).

### Requirement 4: Chat Responsivo

**User Story:** Como usuario, quiero que el panel de chat se adapte correctamente a distintos tamaños de pantalla, para poder usarlo cómodamente en cualquier dispositivo.

#### Acceptance Criteria

1. WHILE el viewport tiene un ancho menor a 768px, THE Chat SHALL renderizarse como un bottom sheet anclado a la parte inferior de la pantalla, ocupando el 100% del ancho del viewport y el 60% de la altura del viewport, con border-radius aplicado únicamente en las esquinas superiores.
2. WHILE el viewport tiene un ancho entre 768px y 1023px, THE Chat SHALL renderizarse con un ancho de 360px y una altura de 450px.
3. WHILE el viewport tiene un ancho mayor o igual a 1024px, THE Chat SHALL renderizarse con un ancho de 400px y una altura de 500px.
4. THE Chat SHALL posicionarse con posición fija relativo a la esquina inferior izquierda de la pantalla, con un desplazamiento de 24px desde el borde inferior y 24px desde el borde izquierdo en viewports de 768px o más, y con 0px de desplazamiento en viewports menores a 768px.
5. THE botón flotante de apertura del Chat (FAB) SHALL posicionarse con posición fija en la esquina inferior izquierda de la pantalla, con un desplazamiento de 24px desde el borde inferior y 24px desde el borde izquierdo en viewports de 768px o más, y 16px desde ambos bordes en viewports menores a 768px.

### Requirement 5: Transiciones y Animaciones

**User Story:** Como usuario, quiero que los cambios de estado del layout se realicen con transiciones suaves, para que la experiencia no sea abrupta ni desorientadora.

#### Acceptance Criteria

1. THE Sistema_Layout SHALL aplicar transiciones CSS de opacidad y transform (translateX o scale) con una duración entre 200ms y 300ms para todos los cambios de visibilidad del Panel_Izquierdo, el Panel_Derecho y el Chat.
2. THE Sistema_Layout SHALL utilizar funciones de timing `ease-out` para las transiciones de apertura y `ease-in` para las transiciones de cierre.
3. WHILE una transición de panel está en curso, THE Sistema_Layout SHALL mantener los elementos no animados (incluido el canvas de react-flow) receptivos a eventos de puntero, teclado y scroll sin aplicar `pointer-events: none` ni overlays bloqueantes sobre ellos.
4. IF el usuario activa un toggle de panel mientras una transición de ese mismo panel está en curso, THEN THE Sistema_Layout SHALL cancelar la transición actual y ejecutar la transición inversa desde la posición intermedia sin esperar a que la primera termine.
5. IF el usuario tiene habilitada la preferencia `prefers-reduced-motion: reduce` en su sistema operativo, THEN THE Sistema_Layout SHALL aplicar las transiciones con duración de 0ms, eliminando la animación visual pero manteniendo el cambio de estado inmediato.
6. THE Sistema_Layout SHALL utilizar exclusivamente propiedades CSS optimizables por GPU (opacity, transform) para las animaciones de paneles, sin animar propiedades que causen reflow del layout (width, height, margin, padding).

### Requirement 6: Accesibilidad de los Controles Toggle

**User Story:** Como usuario que utiliza tecnologías asistivas, quiero que los botones toggle sean accesibles, para poder operar los paneles sin depender exclusivamente del mouse.

#### Acceptance Criteria

1. THE Botón_Toggle_Izquierdo SHALL incluir un atributo `aria-expanded` que refleje el estado actual del Panel_Izquierdo (true cuando está visible, false cuando está oculto).
2. THE Botón_Toggle_Chat SHALL incluir un atributo `aria-expanded` que refleje el estado actual del Chat.
3. THE Botón_Toggle_Izquierdo SHALL incluir un atributo `aria-label` descriptivo con el texto "Abrir panel lateral" o "Cerrar panel lateral" según el estado.
4. THE Botón_Toggle_Chat SHALL incluir un atributo `aria-label` descriptivo con el texto "Abrir chat" o "Cerrar chat" según el estado.
5. THE Botón_Toggle_Izquierdo y el Botón_Toggle_Chat SHALL ser operables mediante teclado (Enter y Space).
6. WHEN un panel se oculta por efecto de otro panel (ej. Vista_Completa), THE Sistema_Layout SHALL mover el foco al botón de cierre del panel que provocó la ocultación, para evitar foco perdido en elementos no visibles.
