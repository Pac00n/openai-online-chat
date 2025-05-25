# Resumen del Proyecto: Chat Inteligente con Herramientas (Análisis Actual)

Este documento resume el estado y funcionamiento actual del proyecto de chat inteligente, basándose en la revisión del código fuente.

## Arquitectura General

*   **Principalmente Frontend:** El proyecto actual es una aplicación frontend, probablemente desarrollada con React y TypeScript.
*   **Servidores de Herramientas Externos (Conceptuales):** La noción de "backend" se refiere a servidores de herramientas externos que implementarían el Protocolo de Contexto del Modelo (MCP). Actualmente, no hay un backend tradicional que sirva la aplicación o una implementación completa de cliente/servidor MCP.

## Flujo del Chat y Lógica Principal

1.  **Configuración (Interfaz de Usuario):**
    *   El componente `src/components/ConfigPanel.tsx` permite al usuario ingresar:
        *   API Key de OpenAI (obligatoria).
        *   URL de un servidor MCP (opcional, para conexión WebSocket).
        *   Opciones para habilitar/deshabilitar herramientas (actualmente simuladas en el frontend):
            *   Servidor de Tiempo.
            *   Búsqueda Web (con proveedores como `pskill9/web-search` (simulación de scraping), Brave Search API (llamada directa a API) o `docker` (simulación)).
    *   La configuración se almacena en `localStorage` y se gestiona en el estado del componente `src/pages/Index.tsx`.

2.  **Inicialización del Servicio (`src/services/ChatService.ts`):**
    *   `ChatService` se inicializa con la configuración proporcionada.
    *   **Registro de Herramientas (Simulado):** Las herramientas disponibles (ej. para tiempo y búsqueda web) están predefinidas en `ChatService` (`this.availableTools`). No hay un descubrimiento dinámico de herramientas desde un servidor MCP externo.
    *   **Conexión WebSocket:** Si se configura un `mcpServerUrl`, `ChatService` establece una conexión WebSocket. Sin embargo, el código actual **no utiliza esta conexión para la comunicación basada en el protocolo MCP** (descubrimiento o invocación de herramientas).

3.  **Proceso de Envío de Mensajes:**
    *   El usuario envía un mensaje a través de la interfaz en `src/pages/Index.tsx`.
    *   `ChatService.sendMessage` maneja el mensaje:
        *   **Detección de Intenciones (Simulada):** Se realiza un intento básico de detectar intenciones de búsqueda web o consulta de tiempo basándose en palabras clave. Esta lógica reside en el frontend y no es una capacidad intrínseca del modelo de IA en este punto.
        *   **Ejecución de "Herramientas":**
            *   **Búsqueda Web:** Si se detecta la intención y está habilitada, se utiliza el proveedor configurado:
                *   `pskill9`: Intenta un scraping de Google (vía proxy CORS).
                *   `Brave`: Llama directamente a la API de Brave Search (si la clave está configurada).
                *   `docker`: Es una simulación y devuelve resultados de ejemplo.
            *   **Tiempo:** Si se detecta la intención y está habilitada, se utilizan funciones simuladas dentro de `ChatService`.
        *   Los resultados de estas operaciones se añaden como contexto al mensaje del usuario.
        *   **Llamada a OpenAI:** Se construye un *prompt* para la API de OpenAI. Este *prompt* incluye:
            *   Un mensaje de sistema que describe al asistente y las herramientas *simuladas* disponibles (según `this.availableTools`).
            *   El historial de conversación.
            *   El mensaje original del usuario, aumentado con el contexto de los resultados de las "herramientas".
        *   La solicitud se envía a la API de chat de OpenAI.
    *   La respuesta generada por OpenAI se muestra en la interfaz.

## Estado de la Implementación del Protocolo MCP

*   **Descubrimiento de Herramientas:** No implementado. Las herramientas son estáticas y definidas en el frontend.
*   **Invocación de Herramientas vía MCP:** No implementado. La conexión WebSocket a `mcpServerUrl` existe, pero no se usa para invocar herramientas remotas mediante un protocolo MCP. Las "llamadas a herramientas" son simulaciones internas o llamadas directas a APIs (como Brave).
*   **Funcionalidad Central del MCP:** La capacidad descrita de que el modelo de IA "descubra y use funciones disponibles en otros lugares" a través de MCP no está implementada en la práctica actual.

## Conclusión del Análisis

El proyecto cuenta con una interfaz de chat funcional que se conecta a OpenAI. Incluye la infraestructura básica para configurar y simular el uso de herramientas externas (tiempo y búsqueda web). La conexión a un servidor MCP vía WebSocket está presente, pero la lógica del protocolo MCP (descubrimiento e invocación dinámica de herramientas) es el siguiente gran paso de desarrollo para alcanzar la visión completa del proyecto. Las "herramientas" actuales son mayormente simulaciones o integraciones directas en el frontend.
