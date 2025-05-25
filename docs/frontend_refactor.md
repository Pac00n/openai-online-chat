# Documentación del Refactor del Frontend

Con la decisión de implementar un backend dedicado para manejar la lógica de herramientas MCP y la comunicación con OpenAI, el frontend ha sido refactorizado para simplificar su responsabilidad.

## Cambios Principales

1.  **`src/components/ConfigPanel.tsx` (Panel de Configuración):**
    *   Se eliminaron todas las opciones de configuración relacionadas con servidores MCP, incluyendo:
        *   URL del Servidor MCP (`mcpServerUrl`).
        *   Habilitación de servidor de tiempo simulado (`enableTimeServer`).
        *   Habilitación de búsqueda web MCP (`enableWebSearch`).
        *   Selección de proveedor de búsqueda web (`webSearchProvider`).
        *   API Key de Brave (`braveApiKey`).
    *   La configuración ahora se centra únicamente en:
        *   `openaiApiKey`: Clave API de OpenAI (que el frontend podría pasar al backend al iniciar la conexión).
        *   `model`: Modelo de OpenAI a utilizar (información que también se pasaría al backend).
    *   La validación y la interfaz de usuario se simplificaron para reflejar estos cambios.

2.  **`src/pages/Index.tsx` (Página Principal del Chat):**
    *   La interfaz `Config` y el estado inicial para `config` se ajustaron para coincidir con la configuración simplificada (solo `openaiApiKey` y `model`).
    *   La función `handleConfigSave` ahora solo guarda `openaiApiKey` y `model` en `localStorage`.
    *   La lógica de inicialización (`initializeServices`) fue renombrada a `initializeAndConnectBackend`. Su propósito ahora es conectar con el nuevo servidor backend.
    *   El estado `isConnected` fue renombrado a `isBackendConnected` para indicar el estado de la conexión con el backend.
    *   Se eliminaron los badges y otros elementos de la interfaz que mostraban el estado de herramientas MCP específicas, ya que el backend gestionará esta lógica.

3.  **`src/services/ChatService.ts` (Servicio de Chat del Frontend):**
    *   **Reescritura Completa:** Este servicio fue el más afectado y se reescribió para actuar como un cliente delgado para el nuevo backend.
    *   **Conexión al Backend:**
        *   Ahora se conecta a un endpoint WebSocket del backend (por defecto configurado a `ws://localhost:3001/chat`, pero podría ser configurable).
        *   El método `initialize` establece esta conexión y puede enviar un mensaje `INIT` al backend (por ejemplo, para pasar la configuración de OpenAI que el backend usará para la sesión del usuario).
    *   **Envío de Mensajes (`sendMessage`):**
        *   Envía un mensaje `USER_MESSAGE` (o similar) al backend, incluyendo el contenido del mensaje del usuario y un historial reciente.
        *   Utiliza un `messageId` para rastrear las respuestas del backend de forma asíncrona.
    *   **Recepción de Mensajes (`onmessage`):**
        *   Espera respuestas del backend que contengan el `messageId` correspondiente.
        *   Maneja diferentes tipos de respuesta del backend (ej. `ASSISTANT_RESPONSE`, `ERROR`).
    *   **Lógica Eliminada:**
        *   Se eliminó toda la lógica de conexión directa a servidores MCP.
        *   Se eliminó la implementación del protocolo MCP (`list_tools`, `invoke`).
        *   Se eliminó el manejo directo del flujo de `tool_calls` de OpenAI.
        *   Se eliminaron las herramientas simuladas de tiempo y búsqueda web.
    *   **Responsabilidad:** Ahora, `ChatService.ts` solo se encarga de la comunicación WebSocket con el backend y de pasar los mensajes entre el frontend y el backend.

## Impacto General

*   El frontend se vuelve significativamente más simple y se enfoca en la presentación y la interacción del usuario.
*   La complejidad de la gestión de herramientas, la lógica de comunicación con OpenAI, y la configuración de servidores externos se delega completamente al nuevo backend.
*   Esto prepara el camino para una solución más robusta, segura y flexible.
