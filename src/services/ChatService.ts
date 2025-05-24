
interface Config {
  openaiApiKey: string;
  mcpServerUrl: string;
  model: string;
  enableTimeServer: boolean;
  enableWebSearch: boolean;
  webSearchProvider: 'pskill9' | 'brave' | 'docker';
  braveApiKey: string;
}

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  searchResults?: any[];
  tools?: any[];
}

interface ChatResponse {
  content: string;
  searchResults?: any[];
  tools?: any[];
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

export class ChatService {
  private config: Config | null = null;
  private mcpConnection: WebSocket | null = null;
  private availableTools: MCPTool[] = [];

  async initialize(config: Config): Promise<void> {
    this.config = config;
    
    if (config.enableTimeServer) {
      await this.initializeTimeServer();
    }
    
    if (config.enableWebSearch) {
      await this.initializeWebSearchServer();
    }
    
    if (config.mcpServerUrl) {
      await this.connectToMCP();
    }
  }

  private async initializeTimeServer(): Promise<void> {
    const timeTools = [
      {
        name: 'getCurrentTime',
        description: 'Get the current time for a specific timezone',
        inputSchema: {
          type: 'object',
          properties: {
            timezone: {
              type: 'string',
              description: 'Timezone (e.g., "America/New_York", "Europe/Madrid", "Asia/Tokyo")'
            }
          },
          required: ['timezone']
        }
      },
      {
        name: 'getTimeDifference',
        description: 'Calculate time difference between two timezones',
        inputSchema: {
          type: 'object',
          properties: {
            timezone1: { type: 'string', description: 'First timezone' },
            timezone2: { type: 'string', description: 'Second timezone' }
          },
          required: ['timezone1', 'timezone2']
        }
      }
    ];
    
    this.availableTools.push(...timeTools);
    console.log('Time MCP Server tools initialized:', timeTools);
  }

  private async initializeWebSearchServer(): Promise<void> {
    if (!this.config) return;

    let searchTools: MCPTool[] = [];

    switch (this.config.webSearchProvider) {
      case 'pskill9':
        searchTools = [
          {
            name: 'search',
            description: 'Search the web using Google scraping',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query' },
                limit: { type: 'number', description: 'Number of results (default: 5)', default: 5 }
              },
              required: ['query']
            }
          }
        ];
        break;

      case 'brave':
        searchTools = [
          {
            name: 'brave_web_search',
            description: 'Search the web using Brave Search API',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query' },
                count: { type: 'number', description: 'Number of results (default: 10)', default: 10 },
                offset: { type: 'number', description: 'Offset for pagination (default: 0)', default: 0 }
              },
              required: ['query']
            }
          },
          {
            name: 'brave_local_search',
            description: 'Search for local businesses using Brave Search API',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Local search query' },
                count: { type: 'number', description: 'Number of results (default: 10)', default: 10 }
              },
              required: ['query']
            }
          }
        ];
        break;

      case 'docker':
        searchTools = [
          {
            name: 'google_search',
            description: 'Search using Docker-based Google search with caching',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query' },
                num_results: { type: 'number', description: 'Number of results', default: 10 }
              },
              required: ['query']
            }
          }
        ];
        break;
    }

    this.availableTools.push(...searchTools);
    console.log(`${this.config.webSearchProvider} Web Search MCP Server tools initialized:`, searchTools);
  }

  private async connectToMCP(): Promise<void> {
    if (!this.config) throw new Error('Configuration not set');

    return new Promise((resolve, reject) => {
      try {
        this.mcpConnection = new WebSocket(this.config.mcpServerUrl);
        
        this.mcpConnection.onopen = () => {
          console.log('Connected to additional MCP server');
          resolve();
        };

        this.mcpConnection.onerror = (error) => {
          console.error('MCP connection error:', error);
          reject(new Error('Failed to connect to MCP server'));
        };

        this.mcpConnection.onclose = () => {
          console.log('MCP connection closed');
        };

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
      const searchQuery = this.extractSearchIntent(message);
      const timeQuery = this.extractTimeIntent(message);
      
      let searchResults: any[] = [];
      let toolResults: any[] = [];

      if (searchQuery && this.config.enableWebSearch) {
        searchResults = await this.performWebSearch(searchQuery);
      }

      if (timeQuery && this.config.enableTimeServer) {
        toolResults = await this.handleTimeQuery(timeQuery);
      }

      // Prepare enhanced context for OpenAI
      let contextualInfo = '';
      if (searchResults.length > 0) {
        contextualInfo += `\n\nResultados de búsqueda web: ${JSON.stringify(searchResults.slice(0, 3))}`;
      }
      if (toolResults.length > 0) {
        contextualInfo += `\n\nInformación de herramientas MCP: ${JSON.stringify(toolResults)}`;
      }

      const messages = [
        {
          role: 'system',
          content: `Eres un asistente inteligente con acceso a herramientas MCP para obtener información de tiempo y búsquedas web en tiempo real. 
          
          Herramientas disponibles:
          ${this.availableTools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}
          
          Cuando tengas resultados de herramientas o búsquedas, úsalos para enriquecer tus respuestas.
          Sé conciso pero informativo. Siempre responde en español.`
        },
        ...conversationHistory.slice(-6).map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        {
          role: 'user',
          content: message + contextualInfo
        }
      ];

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
        searchResults: searchResults.length > 0 ? searchResults : undefined,
        tools: toolResults.length > 0 ? toolResults : undefined
      };
    } catch (error) {
      console.error('Error in sendMessage:', error);
      throw error;
    }
  }

  private extractTimeIntent(message: string): string | null {
    const timeKeywords = [
      'hora', 'tiempo', 'reloj', 'horario', 'zona horaria', 'timezone',
      'qué hora es', 'hora actual', 'diferencia horaria', 'tiempo en'
    ];

    const messageLower = message.toLowerCase();
    const hasTimeIntent = timeKeywords.some(keyword => messageLower.includes(keyword));

    return hasTimeIntent ? message : null;
  }

  private async handleTimeQuery(query: string): Promise<any[]> {
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('diferencia')) {
      return [{
        tool: 'getTimeDifference',
        result: 'Diferencia horaria calculada usando MCP Time Server',
        details: 'Herramienta de diferencia horaria simulada'
      }];
    } else {
      return [{
        tool: 'getCurrentTime',
        result: `Hora actual obtenida del servidor MCP Time: ${new Date().toLocaleString('es-ES')}`,
        details: 'Tiempo actual desde Time MCP Server'
      }];
    }
  }

  private extractSearchIntent(message: string): string | null {
    const searchKeywords = [
      'busca', 'buscar', 'encuentra', 'encontrar', 'qué es', 'quién es',
      'cuál es', 'cómo', 'dónde', 'cuándo', 'por qué', 'información sobre',
      'noticias', 'últimas', 'actualidad', 'precio', 'cotización', 'tendencias'
    ];

    const messageLower = message.toLowerCase();
    const shouldSearch = searchKeywords.some(keyword => messageLower.includes(keyword));

    return shouldSearch ? message : null;
  }

  private async performWebSearch(query: string): Promise<any[]> {
    if (!this.config) return [];

    try {
      // Simulate different search providers
      let searchProvider = '';
      let providerDetails = '';

      switch (this.config.webSearchProvider) {
        case 'pskill9':
          searchProvider = 'pskill9/web-search';
          providerDetails = 'Raspado de Google sin credenciales';
          break;
        case 'brave':
          searchProvider = 'Brave Search API';
          providerDetails = 'API oficial de Brave Search';
          break;
        case 'docker':
          searchProvider = 'Docker Search Server';
          providerDetails = 'Servidor con caché y back-off automático';
          break;
      }

      // Simulate search results
      return new Promise((resolve) => {
        setTimeout(() => {
          const mockResults = [
            {
              title: `Resultado de ${searchProvider}: ${query}`,
              snippet: `Información encontrada usando ${providerDetails} sobre ${query}. Resultados actualizados en tiempo real.`,
              url: `https://ejemplo.com/search?q=${encodeURIComponent(query)}&provider=${this.config?.webSearchProvider}`,
              content: `Contenido detallado sobre ${query} obtenido mediante ${searchProvider}`,
              provider: searchProvider
            },
            {
              title: `Información adicional: ${query}`,
              snippet: `Más detalles sobre ${query} encontrados con herramientas MCP de búsqueda web. ${providerDetails}.`,
              url: `https://ejemplo.com/info?q=${encodeURIComponent(query)}&provider=${this.config?.webSearchProvider}`,
              content: `Información complementaria sobre ${query} desde ${searchProvider}`,
              provider: searchProvider
            }
          ];
          resolve(mockResults);
        }, 1000);
      });
    } catch (error) {
      console.error('Error in web search:', error);
      return [];
    }
  }

  disconnect(): void {
    if (this.mcpConnection) {
      this.mcpConnection.close();
      this.mcpConnection = null;
    }
  }
}
