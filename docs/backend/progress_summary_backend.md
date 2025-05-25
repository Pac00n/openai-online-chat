# Resumen del Progreso del Desarrollo del Backend

Este documento resume el estado de desarrollo del servidor backend para el proyecto de Chat Inteligente, incluyendo la integración con OpenAI y el inicio de la integración con herramientas MCP (específicamente Brave Search MCP Server).

## 1. Configuración y Estructura del Backend

*   **Tecnología:** Node.js con TypeScript.
*   **Comunicación con Frontend:** Se ha implementado un servidor WebSocket usando la librería `ws`. Este servidor escucha en un puerto configurable (por defecto `3001`) en la ruta `/chat`.
*   **Variables de Entorno:**
    *   Se utiliza el paquete `dotenv` para cargar variables de entorno desde un archivo `.env` en el directorio `backend/` durante el desarrollo.
    *   Variables configuradas:
        *   `OPENAI_API_KEY`: Obligatoria para la comunicación con la API de OpenAI.
        *   `BRAVE_API_KEY`: Obligatoria para el funcionamiento del Brave Search MCP Server.
        *   `PORT`: Opcional para configurar el puerto del servidor WebSocket del backend.
*   **Estructura de Archivos:**
    *   `backend/src/index.ts`: Punto de entrada principal que contiene toda la lógica del servidor.
    *   `backend/package.json`: Gestiona dependencias y scripts (`dev`, `build`, `start`).
    *   `backend/tsconfig.json`: Configuración del compilador de TypeScript.
    *   `backend/.env`: (No versionado) Almacena las API keys.
    *   `backend/.env.example`: Archivo de ejemplo para las variables de entorno.

## 2. Comunicación Frontend-Backend

*   El frontend (`ChatService.ts` refactorizado) establece una conexión WebSocket con el backend.
*   **Mensaje `INIT`:** Al conectar, el frontend puede enviar un mensaje `INIT` para configurar parámetros de la sesión, como el modelo de OpenAI a utilizar. El backend ya no espera la `OPENAI_API_KEY` del frontend.
*   **Mensaje `USER_MESSAGE`:** El frontend envía los mensajes del usuario (con un `messageId` para seguimiento y el historial reciente) al backend.
*   **Respuesta del Backend:** El backend responde con un mensaje `ASSISTANT_RESPONSE` (conteniendo la respuesta final de la IA) o `ERROR`, ambos con el `messageId` correspondiente.

## 3. Integración con la API de OpenAI

*   Cuando el backend recibe un `USER_MESSAGE` del frontend:
    *   Utiliza la `OPENAI_API_KEY` (cargada desde sus variables de entorno) para autenticarse con OpenAI.
    *   Construye un payload para la API de Chat Completions de OpenAI, incluyendo:
        *   Un prompt de sistema.
        *   El historial de conversación reciente.
        *   El mensaje actual del usuario.
    *   Realiza una llamada `fetch` a `https://api.openai.com/v1/chat/completions`.
    *   Procesa la respuesta de OpenAI.
    *   Si no se utilizan herramientas MCP (ver siguiente sección), la respuesta directa de OpenAI se envía al frontend.

## 4. Integración con Brave Search MCP Server (En Progreso)

Se ha implementado la lógica para integrar el `Brave Search MCP Server` como una herramienta externa.

*   **Inicio del Subproceso:**
    *   Si `BRAVE_API_KEY` está definida, el backend intenta iniciar el `@modelcontextprotocol/server-brave-search` como un subproceso usando `child_process.spawn` (ejecutado vía `npx`).
    *   La `BRAVE_API_KEY` se pasa como variable de entorno al subproceso.
*   **Comunicación con el Subproceso MCP (STDIO):**
    *   El backend maneja `stdout`, `stdin`, y `stderr` del subproceso Brave MCP.
    *   Se ha implementado un mecanismo de buffer para leer mensajes JSON completos (delimitados por nueva línea) desde el `stdout` del subproceso.
*   **Descubrimiento de Herramientas (`list_tools`):**
    *   Al iniciar el subproceso Brave MCP, el backend le envía automáticamente un mensaje `{"protocol": "mcp", "action": "list_tools"}` a su `stdin`.
    *   Las herramientas devueltas (ej. `brave_web_search`, `brave_local_search`) se almacenan en una variable `braveMcpTools`.
*   **Invocación de Herramientas (`invoke`):**
    *   Se ha creado una función `sendToBraveMcp` para enviar mensajes (`list_tools` o `invoke`) al subproceso y manejar las respuestas de forma asíncrona usando promesas y IDs de solicitud.
*   **Flujo de Interacción con OpenAI y Herramientas Brave:**
    1.  Cuando se prepara la llamada a OpenAI, si hay herramientas de Brave disponibles (`braveMcpTools`), se incluyen en la solicitud a OpenAI (formato `tools` y `tool_choice: "auto"`).
    2.  Si la respuesta de OpenAI incluye `tool_calls` (es decir, OpenAI decide usar una herramienta de Brave):
        *   El backend extrae el nombre de la herramienta y los argumentos.
        *   Envía un mensaje `invoke` al subproceso Brave MCP con esta información.
        *   Espera la respuesta del subproceso Brave (los resultados de la búsqueda).
        *   **Segunda Llamada a OpenAI:** Se realiza una nueva llamada a OpenAI, esta vez incluyendo el historial original, la solicitud de herramienta de OpenAI, y los resultados obtenidos de la herramienta Brave.
        *   La respuesta de esta segunda llamada (que debería ser una respuesta en lenguaje natural basada en los resultados de la herramienta) se envía al frontend.
    3.  Si OpenAI no solicita `tool_calls`, se envía su respuesta directa al frontend.
*   **Manejo de Errores:** Se ha implementado un manejo básico de errores para la comunicación con el subproceso y con OpenAI.

## 5. Refactor del Frontend

*   El frontend ha sido simplificado significativamente (ver `docs/frontend_refactor.md`).
*   `ChatService.ts` ahora solo se comunica con el backend vía WebSocket, delegando toda la lógica de OpenAI y MCP al backend.

## Próximos Pasos Potenciales

*   Pruebas exhaustivas del flujo completo con Brave Search MCP.
*   Mejorar la robustez del manejo del subproceso Brave MCP (ej. reinicios automáticos, mejor detección de estado "listo").
*   Implementar manejo de múltiples `tool_calls` en una sola respuesta de OpenAI.
*   Integrar otros servidores MCP si es necesario.
*   Refinar el logging y el monitoreo.
*   Considerar la seguridad y la gestión de configuración para un entorno de producción.
