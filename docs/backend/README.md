# Documentación del Backend

Esta sección contiene la documentación para el backend del proyecto Chat Inteligente.

## Estructura del Proyecto Backend

El backend está desarrollado en Node.js con TypeScript.

*   `backend/`
    *   `node_modules/`: Dependencias del proyecto backend.
    *   `src/`:
        *   `index.ts`: Punto de entrada principal del código del servidor backend. Aquí se configurará el servidor (Express, WebSocket, etc.), la lógica de negocio, la comunicación con OpenAI y los servidores MCP.
    *   `dist/`: Carpeta donde se guardarán los archivos JavaScript compilados desde TypeScript (generada después de `npm run build`).
    *   `package.json`: Define las dependencias del backend, metadatos del proyecto y scripts (como `build`, `start`, `dev`).
    *   `tsconfig.json`: Archivo de configuración para el compilador de TypeScript.

## Empezando con el Backend

1.  **Navegar al Directorio del Backend:**
    ```bash
    cd backend
    ```

2.  **Instalar Dependencias (si no se ha hecho antes o después de clonar):**
    ```bash
    npm install
    ```

3.  **Ejecutar en Modo Desarrollo:**
    Este comando usa `ts-node-dev` para ejecutar el servidor TypeScript directamente, con reinicio automático al detectar cambios.
    ```bash
    npm run dev
    ```
    El servidor (inicialmente) imprimirá mensajes en la consola indicando que está iniciando.

4.  **Compilar para Producción:**
    Este comando usa `tsc` para compilar el código de `src/` a JavaScript en `dist/`.
    ```bash
    npm run build
    ```

5.  **Ejecutar en Modo Producción:**
    Este comando ejecuta el código JavaScript compilado desde la carpeta `dist/`.
    ```bash
    npm run start
    ```

## Próximos Pasos de Desarrollo del Backend

1.  **Elegir e implementar un framework de servidor:**
    *   Para comunicación HTTP/REST: Express.js o Fastify.
    *   Para comunicación WebSocket: `ws` o `socket.io`.
    *   Una combinación podría ser necesaria si se quiere ofrecer tanto API REST como WebSockets.
2.  **Definir la API de comunicación entre Frontend y Backend.**
3.  **Implementar la lógica para gestionar servidores MCP como subprocesos.**
4.  **Integrar el SDK de OpenAI o llamadas directas a su API.**
5.  **Manejar la orquestación del chat y el uso de herramientas.**
