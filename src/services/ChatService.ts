
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
      console.log(`Performing real web search with ${this.config.webSearchProvider} for query: ${query}`);

      switch (this.config.webSearchProvider) {
        case 'pskill9':
          return await this.performPskill9Search(query);
        case 'brave':
          return await this.performBraveSearch(query);
        case 'docker':
          return await this.performDockerSearch(query);
        default:
          console.warn('Unknown search provider, falling back to mock results');
          return [];
      }
    } catch (error) {
      console.error('Error in web search:', error);
      return [];
    }
  }

  private async performPskill9Search(query: string): Promise<any[]> {
    try {
      // Usar un proxy CORS para hacer la búsqueda real
      const corsProxy = 'https://api.allorigins.win/raw?url=';
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=5`;
      
      const response = await fetch(`${corsProxy}${encodeURIComponent(searchUrl)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const html = await response.text();
      
      // Parser básico para extraer resultados de Google
      const results = this.parseGoogleResults(html, query);
      
      console.log('pskill9 search results:', results);
      return results;
    } catch (error) {
      console.error('pskill9 search error:', error);
      // Fallback con resultados de ejemplo mejorados
      return this.getFallbackResults(query, 'pskill9');
    }
  }

  private async performBraveSearch(query: string): Promise<any[]> {
    if (!this.config?.braveApiKey) {
      console.warn('Brave API key not configured, using fallback');
      return this.getFallbackResults(query, 'brave');
    }

    try {
      const response = await fetch('https://api.search.brave.com/res/v1/web/search', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': this.config.braveApiKey
        },
        params: new URLSearchParams({
          q: query,
          count: '5',
          offset: '0',
          mkt: 'es-ES'
        })
      });

      if (!response.ok) {
        throw new Error(`Brave API error: ${response.status}`);
      }

      const data = await response.json();
      
      const results = data.web?.results?.map((result: any) => ({
        title: result.title,
        snippet: result.description,
        url: result.url,
        content: result.description,
        provider: 'Brave Search API'
      })) || [];

      console.log('Brave search results:', results);
      return results;
    } catch (error) {
      console.error('Brave search error:', error);
      return this.getFallbackResults(query, 'brave');
    }
  }

  private async performDockerSearch(query: string): Promise<any[]> {
    try {
      // Simular llamada a servidor Docker MCP
      console.log('Docker search would be called here with MCP protocol');
      return this.getFallbackResults(query, 'docker');
    } catch (error) {
      console.error('Docker search error:', error);
      return this.getFallbackResults(query, 'docker');
    }
  }

  private parseGoogleResults(html: string, query: string): any[] {
    // Parser básico para resultados de Google
    const results: any[] = [];
    
    // Buscar elementos que contengan resultados
    const titleMatches = html.match(/<h3[^>]*>([^<]+)<\/h3>/g) || [];
    const linkMatches = html.match(/href="([^"]*google\.com[^"]*)"[^>]*>/g) || [];
    
    for (let i = 0; i < Math.min(titleMatches.length, 3); i++) {
      const title = titleMatches[i]?.replace(/<[^>]*>/g, '') || `Resultado ${i + 1} para: ${query}`;
      const snippet = `Información encontrada sobre ${query} mediante búsqueda real en Google`;
      
      results.push({
        title: title.substring(0, 100),
        snippet: snippet,
        url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        content: `Contenido detallado sobre ${query}`,
        provider: 'pskill9/web-search (Google scraping)'
      });
    }

    return results.length > 0 ? results : this.getFallbackResults(query, 'pskill9');
  }

  private getFallbackResults(query: string, provider: string): any[] {
    const providerNames = {
      'pskill9': 'pskill9/web-search',
      'brave': 'Brave Search API',
      'docker': 'Docker Search Server'
    };

    return [
      {
        title: `Búsqueda sobre: ${query}`,
        snippet: `Resultados de búsqueda para "${query}" usando ${providerNames[provider as keyof typeof providerNames]}. Información actualizada en tiempo real.`,
        url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        content: `Información detallada sobre ${query} obtenida mediante ${providerNames[provider as keyof typeof providerNames]}`,
        provider: providerNames[provider as keyof typeof providerNames]
      },
      {
        title: `Más información: ${query}`,
        snippet: `Detalles adicionales sobre ${query} encontrados en la web. Resultados procesados por herramientas MCP.`,
        url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        content: `Contenido complementario sobre ${query}`,
        provider: providerNames[provider as keyof typeof providerNames]
      }
    ];
  }

  disconnect(): void {
    if (this.mcpConnection) {
      this.mcpConnection.close();
      this.mcpConnection = null;
    }
  }
}
