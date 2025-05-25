
// Interfaz de configuración que ChatService podría recibir (principalmente para OpenAI, manejada por el backend)
interface BackendServiceConfig {
  openaiApiKey: string; // El backend la usará, el frontend solo la pasa si es necesario.
  model: string;        // Ídem.
  backendUrl?: string;   // URL del servidor backend de chat (ej: ws://localhost:3001/chat)
}

// Interfaz para mensajes (podría ser la misma que en Index.tsx)
interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  tools?: any[]; // Si el backend aún envía información de herramientas usadas para visualización
}

// Interfaz para la respuesta esperada del backend tras enviar un mensaje
interface BackendChatResponse {
  content: string;
  tools?: any[]; // Opcional: si el backend informa qué herramientas usó
}

const DEFAULT_BACKEND_URL = 'ws://localhost:3001/chat'; // Ajusta según el puerto de tu backend

export class ChatService {
  private backendConnection: WebSocket | null = null;
  private serviceConfig: BackendServiceConfig | null = null;
  
  // Almacena las promesas de mensajes pendientes para asociar respuestas del backend
  private pendingMessages: Map<string, { resolve: (value: BackendChatResponse) => void; reject: (reason?: any) => void }> = new Map();
  private messageCounter = 0;

  public async initialize(config: BackendServiceConfig): Promise<void> {
    this.serviceConfig = config;
    const backendUrl = config.backendUrl || DEFAULT_BACKEND_URL;

    return new Promise((resolve, reject) => {
      if (this.backendConnection && this.backendConnection.readyState === WebSocket.OPEN) {
        console.log('Backend connection already open.');
        resolve();
        return;
      }

      console.log(`Attempting to connect to backend chat server: ${backendUrl}`);
      this.backendConnection = new WebSocket(backendUrl);

      this.backendConnection.onopen = () => {
        console.log('Successfully connected to backend chat server.');
        // Enviar un mensaje de inicialización/autenticación si el backend lo requiere
        // Por ejemplo, enviar la config de OpenAI para que el backend la use para esta sesión/conexión
        if (this.backendConnection && this.serviceConfig) {
            this.backendConnection.send(JSON.stringify({
                type: 'INIT',
                payload: {
                    openaiApiKey: this.serviceConfig.openaiApiKey,
                    model: this.serviceConfig.model
                }
            }));
        }
        resolve();
      };

      this.backendConnection.onerror = (error) => {
        console.error('Backend WebSocket connection error:', error);
        this.backendConnection = null;
        reject(new Error('Failed to connect to backend chat server'));
      };

      this.backendConnection.onclose = () => {
        console.log('Backend WebSocket connection closed');
        this.backendConnection = null;
        // Aquí se podría manejar la lógica de reconexión si se desea
      };

      this.backendConnection.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data as string);
          console.log('Received message from backend:', response);

          // Asumimos que el backend incluye un `messageId` en su respuesta
          // para que podamos resolver la promesa correcta.
          if (response.messageId && this.pendingMessages.has(response.messageId)) {
            const promiseHandlers = this.pendingMessages.get(response.messageId);
            if (promiseHandlers) {
              if (response.type === 'ASSISTANT_RESPONSE') {
                promiseHandlers.resolve(response.payload as BackendChatResponse);
              } else if (response.type === 'ERROR') {
                promiseHandlers.reject(new Error(response.payload.error || 'Backend error'));
              } else {
                console.warn('Received unknown message type from backend:', response);
                promiseHandlers.reject(new Error('Unknown response type from backend'));
              }
              this.pendingMessages.delete(response.messageId);
            }
          } else {
            console.warn('Received message from backend without a matching pending messageId or unrecognized structure:', response);
          }
        } catch (error) {
          console.error('Error processing message from backend:', error);
          // Si hay un error de parseo, podríamos intentar rechazar todas las promesas pendientes
          // o la más antigua, aunque es difícil saber cuál era.
        }
      };
    });
  }

  public async sendMessage(userMessage: string, conversationHistory: Message[]): Promise<BackendChatResponse> {
    if (!this.backendConnection || this.backendConnection.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to backend chat server.');
    }
    if (!this.serviceConfig) {
      throw new Error('ChatService not initialized with config.');
    }

    const messageId = `msg_${this.messageCounter++}`;
    
    const messagePayload = {
      type: 'USER_MESSAGE',
      messageId: messageId, // ID para rastrear la respuesta
      payload: {
        content: userMessage,
        history: conversationHistory.slice(-10), // Enviar historial reciente
        // La config de OpenAI (apikey, model) podría ya haber sido enviada en INIT
        // o el backend la gestiona de forma global o por sesión.
        // Si se necesita por mensaje:
        // openaiApiKey: this.serviceConfig.openaiApiKey, 
        // model: this.serviceConfig.model,
      }
    };

    const promise = new Promise<BackendChatResponse>((resolve, reject) => {
      this.pendingMessages.set(messageId, { resolve, reject });
    });

    this.backendConnection.send(JSON.stringify(messagePayload));
    console.log(`Sent message to backend (id: ${messageId}):`, messagePayload);

    // Timeout para la respuesta del backend
    const timeoutPromise = new Promise<BackendChatResponse>((_, reject) => 
      setTimeout(() => {
        if (this.pendingMessages.has(messageId)) {
          this.pendingMessages.delete(messageId);
          reject(new Error(`Timeout waiting for response from backend for message id: ${messageId}`));
        }
      }, 30000) // 30 segundos de timeout
    );

    return Promise.race([promise, timeoutPromise]);
  }

  public disconnect(): void {
    if (this.backendConnection) {
      this.backendConnection.close();
      this.backendConnection = null;
    }
    // Limpiar promesas pendientes en caso de desconexión forzada
    this.pendingMessages.forEach(p => p.reject(new Error('Disconnected')));
    this.pendingMessages.clear();
  }
}
