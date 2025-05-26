
export interface N8nConfig {
  webhookUrl: string;
  corsEnabled: boolean;
}

export interface N8nResponse {
  content: string;
  searchResults?: any[];
  tools?: any[];
  error?: string;
}

export class N8nWebhookService {
  private config: N8nConfig;

  constructor(config: N8nConfig) {
    this.config = config;
  }

  async sendMessage(message: string): Promise<N8nResponse> {
    console.log('Enviando mensaje a n8n webhook:', this.config.webhookUrl);
    
    try {
      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Respuesta de n8n:', data);

      // Procesar la respuesta según el formato que devuelva tu workflow
      return this.processN8nResponse(data);
      
    } catch (error) {
      console.error('Error calling n8n webhook:', error);
      throw new Error(`Error conectando con n8n: ${error.message}`);
    }
  }

  private processN8nResponse(data: any): N8nResponse {
    // Adaptar según el formato que devuelva tu AI Agent de n8n
    if (typeof data === 'string') {
      return { content: data };
    }

    // Si el AI Agent devuelve un objeto estructurado
    if (data.response || data.content || data.message) {
      return {
        content: data.response || data.content || data.message,
        searchResults: data.searchResults || data.sources || [],
        tools: data.tools || data.toolCalls || []
      };
    }

    // Si es un array de mensajes del chat
    if (Array.isArray(data) && data.length > 0) {
      const lastMessage = data[data.length - 1];
      return {
        content: lastMessage.content || lastMessage.message || 'Respuesta procesada',
        searchResults: lastMessage.searchResults || [],
        tools: lastMessage.tools || []
      };
    }

    return { content: JSON.stringify(data) };
  }

  updateConfig(config: N8nConfig) {
    this.config = config;
  }
}
