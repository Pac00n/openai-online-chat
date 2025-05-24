
interface Config {
  openaiApiKey: string;
  mcpServerUrl: string;
  model: string;
}

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  searchResults?: any[];
}

interface ChatResponse {
  content: string;
  searchResults?: any[];
}

export class ChatService {
  private config: Config | null = null;
  private mcpConnection: WebSocket | null = null;

  async initialize(config: Config): Promise<void> {
    this.config = config;
    await this.connectToMCP();
  }

  private async connectToMCP(): Promise<void> {
    if (!this.config) throw new Error('Configuration not set');

    return new Promise((resolve, reject) => {
      try {
        this.mcpConnection = new WebSocket(this.config.mcpServerUrl);
        
        this.mcpConnection.onopen = () => {
          console.log('Connected to MCP server');
          resolve();
        };

        this.mcpConnection.onerror = (error) => {
          console.error('MCP connection error:', error);
          reject(new Error('Failed to connect to MCP server'));
        };

        this.mcpConnection.onclose = () => {
          console.log('MCP connection closed');
        };

        // Timeout after 5 seconds
        setTimeout(() => {
          if (this.mcpConnection?.readyState !== WebSocket.OPEN) {
            reject(new Error('MCP connection timeout'));
          }
        }, 5000);
      } catch (error) {
        reject(error);
      }
    });
  }

  async sendMessage(message: string, conversationHistory: Message[]): Promise<ChatResponse> {
    if (!this.config) throw new Error('Service not initialized');

    try {
      // First, check if we need to perform a search
      const searchQuery = this.extractSearchIntent(message);
      let searchResults: any[] = [];

      if (searchQuery) {
        searchResults = await this.performSearch(searchQuery);
      }

      // Prepare the conversation context
      const messages = [
        {
          role: 'system',
          content: `Eres un asistente inteligente que ayuda a los usuarios con sus consultas. 
          Cuando tengas resultados de búsqueda disponibles, úsalos para enriquecer tus respuestas.
          Sé conciso pero informativo. Siempre responde en español.`
        },
        ...conversationHistory.slice(-6).map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        {
          role: 'user',
          content: searchResults.length > 0 
            ? `${message}\n\nResultados de búsqueda disponibles: ${JSON.stringify(searchResults.slice(0, 3))}`
            : message
        }
      ];

      // Call OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: messages,
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || 'No se pudo generar una respuesta.';

      return {
        content,
        searchResults: searchResults.length > 0 ? searchResults : undefined
      };
    } catch (error) {
      console.error('Error in sendMessage:', error);
      throw error;
    }
  }

  private extractSearchIntent(message: string): string | null {
    // Simple heuristics to determine if we should search
    const searchKeywords = [
      'busca', 'buscar', 'encuentra', 'encontrar', 'qué es', 'quién es',
      'cuál es', 'cómo', 'dónde', 'cuándo', 'por qué', 'información sobre',
      'noticias', 'últimas', 'actualidad', 'precio', 'cotización'
    ];

    const messageLower = message.toLowerCase();
    const shouldSearch = searchKeywords.some(keyword => messageLower.includes(keyword));

    return shouldSearch ? message : null;
  }

  private async performSearch(query: string): Promise<any[]> {
    // Simulate MCP search - In a real implementation, this would communicate with the MCP server
    return new Promise((resolve) => {
      setTimeout(() => {
        // Mock search results
        const mockResults = [
          {
            title: `Resultado para: ${query}`,
            snippet: `Información relevante encontrada sobre ${query}. Este es un resultado de búsqueda simulado.`,
            url: `https://ejemplo.com/search?q=${encodeURIComponent(query)}`,
            content: `Contenido detallado sobre ${query}`
          },
          {
            title: `Información adicional: ${query}`,
            snippet: `Más detalles y contexto sobre ${query}. Resultado de búsqueda simulado adicional.`,
            url: `https://ejemplo.com/info?q=${encodeURIComponent(query)}`,
            content: `Información complementaria sobre ${query}`
          }
        ];
        resolve(mockResults);
      }, 1000);
    });
  }

  disconnect(): void {
    if (this.mcpConnection) {
      this.mcpConnection.close();
      this.mcpConnection = null;
    }
  }
}
