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

      // Realizar búsquedas web reales si se detecta intención de búsqueda
      if (searchQuery && this.config.enableWebSearch) {
        console.log('Realizando búsqueda web real para:', searchQuery);
        searchResults = await this.performWebSearch(searchQuery);
        console.log('Resultados de búsqueda obtenidos:', searchResults);
      }

      // Manejar consultas de tiempo
      if (timeQuery && this.config.enableTimeServer) {
        toolResults = await this.handleTimeQuery(timeQuery);
      }

      // Preparar contexto enriquecido para OpenAI con resultados reales
      let contextualInfo = '';
      if (searchResults.length > 0) {
        contextualInfo += `\n\nRESULTADOS DE BÚSQUEDA WEB REALES (${this.config.webSearchProvider}):\n`;
        searchResults.forEach((result, index) => {
          contextualInfo += `${index + 1}. ${result.title}\n`;
          contextualInfo += `   Fuente: ${result.url}\n`;
          contextualInfo += `   Contenido: ${result.snippet}\n`;
          contextualInfo += `   Proveedor: ${result.provider}\n\n`;
        });
        contextualInfo += 'IMPORTANTE: Usa EXCLUSIVAMENTE esta información de búsqueda para responder y SIEMPRE menciona las fuentes específicas.\n';
      }

      if (toolResults.length > 0) {
        contextualInfo += `\n\nHERRAMIENTAS MCP UTILIZADAS:\n${JSON.stringify(toolResults, null, 2)}\n`;
      }

      const messages = [
        {
          role: 'system',
          content: `Eres un asistente que SIEMPRE debe basarse en los resultados de búsqueda proporcionados cuando están disponibles.

REGLAS IMPORTANTES:
- Si tienes resultados de búsqueda, úsalos EXCLUSIVAMENTE para responder
- SIEMPRE menciona las fuentes específicas (URLs) en tu respuesta
- SIEMPRE indica qué herramienta MCP se utilizó para obtener la información
- NO inventes información si no tienes resultados de búsqueda
- Si no hay resultados de búsqueda, indica claramente que no puedes buscar información actualizada

Herramientas MCP disponibles:
${this.availableTools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

Responde siempre en español y sé conciso pero informativo.`
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
          temperature: 0.3, // Reducir temperatura para más precisión
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
      'noticias', 'últimas', 'actualidad', 'precio', 'cotización', 'tendencias',
      'dame información', 'cuéntame sobre', 'explícame', 'detalles sobre'
    ];

    const messageLower = message.toLowerCase();
    const shouldSearch = searchKeywords.some(keyword => messageLower.includes(keyword)) ||
                        messageLower.includes('?'); // También buscar si hay pregunta

    return shouldSearch ? message : null;
  }

  private async performWebSearch(query: string): Promise<any[]> {
    if (!this.config) return [];

    try {
      console.log(`Realizando búsqueda web REAL con ${this.config.webSearchProvider} para: ${query}`);

      switch (this.config.webSearchProvider) {
        case 'pskill9':
          return await this.performPskill9Search(query);
        case 'brave':
          return await this.performBraveSearch(query);
        case 'docker':
          return await this.performDockerSearch(query);
        default:
          console.warn('Proveedor de búsqueda desconocido');
          return [];
      }
    } catch (error) {
      console.error('Error en búsqueda web:', error);
      return [];
    }
  }

  private async performPskill9Search(query: string): Promise<any[]> {
    try {
      console.log('Iniciando búsqueda pskill9 para:', query);
      
      // Usar un servicio de proxy CORS gratuito
      const proxyUrl = 'https://corsproxy.io/?';
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=5&hl=es`;
      
      const response = await fetch(`${proxyUrl}${encodeURIComponent(searchUrl)}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      if (!response.ok) {
        console.error('Error en respuesta pskill9:', response.status, response.statusText);
        throw new Error(`Búsqueda falló: ${response.status}`);
      }

      const html = await response.text();
      console.log('HTML recibido, longitud:', html.length);
      
      const results = this.parseGoogleResults(html, query);
      console.log('Resultados parseados pskill9:', results);
      
      return results;
    } catch (error) {
      console.error('Error en pskill9 search:', error);
      // NO devolver resultados falsos, devolver array vacío
      return [];
    }
  }

  private async performBraveSearch(query: string): Promise<any[]> {
    if (!this.config?.braveApiKey) {
      console.warn('Clave API de Brave no configurada');
      return [];
    }

    try {
      console.log('Iniciando búsqueda Brave para:', query);
      
      const searchParams = new URLSearchParams({
        q: query,
        count: '5',
        offset: '0',
        mkt: 'es-ES'
      });

      const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${searchParams}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': this.config.braveApiKey
        }
      });

      if (!response.ok) {
        console.error('Error en Brave API:', response.status, response.statusText);
        throw new Error(`Error en Brave API: ${response.status}`);
      }

      const data = await response.json();
      console.log('Respuesta Brave API:', data);
      
      const results = data.web?.results?.map((result: any, index: number) => ({
        title: result.title || `Resultado ${index + 1}`,
        snippet: result.description || 'Sin descripción disponible',
        url: result.url || 'URL no disponible',
        content: result.description || 'Contenido no disponible',
        provider: 'Brave Search API',
        timestamp: new Date().toISOString()
      })) || [];

      console.log('Resultados Brave procesados:', results);
      return results;
    } catch (error) {
      console.error('Error en Brave search:', error);
      return [];
    }
  }

  private async performDockerSearch(query: string): Promise<any[]> {
    try {
      console.log('Búsqueda Docker MCP simulada para:', query);
      // Para búsqueda Docker, implementar llamada real al servidor MCP
      // Por ahora retornar vacío hasta implementar servidor real
      return [];
    } catch (error) {
      console.error('Error en Docker search:', error);
      return [];
    }
  }

  private parseGoogleResults(html: string, query: string): any[] {
    const results: any[] = [];
    
    try {
      // Buscar elementos de resultados de Google más específicamente
      const titleRegex = /<h3[^>]*class="[^"]*LC20lb[^"]*"[^>]*>([^<]+)<\/h3>/g;
      const linkRegex = /<a[^>]*href="([^"]*)"[^>]*>[\s\S]*?<h3/g;
      const snippetRegex = /<span[^>]*class="[^"]*VwiC3b[^"]*"[^>]*>([^<]+)<\/span>/g;
      
      let titleMatch;
      let titleMatches = [];
      while ((titleMatch = titleRegex.exec(html)) !== null) {
        titleMatches.push(titleMatch[1]);
      }

      let linkMatch;
      let linkMatches = [];
      while ((linkMatch = linkRegex.exec(html)) !== null) {
        // Filtrar enlaces de Google internos
        if (!linkMatch[1].includes('google.com') && !linkMatch[1].startsWith('/')) {
          linkMatches.push(linkMatch[1]);
        }
      }

      let snippetMatch;
      let snippetMatches = [];
      while ((snippetMatch = snippetRegex.exec(html)) !== null) {
        snippetMatches.push(snippetMatch[1]);
      }

      console.log('Títulos encontrados:', titleMatches.length);
      console.log('Enlaces encontrados:', linkMatches.length);
      console.log('Snippets encontrados:', snippetMatches.length);

      // Combinar resultados
      const maxResults = Math.min(titleMatches.length, 3);
      for (let i = 0; i < maxResults; i++) {
        results.push({
          title: titleMatches[i] || `Resultado ${i + 1} para: ${query}`,
          snippet: snippetMatches[i] || 'Snippet no disponible',
          url: linkMatches[i] || `https://www.google.com/search?q=${encodeURIComponent(query)}`,
          content: snippetMatches[i] || 'Contenido no disponible',
          provider: 'pskill9/web-search (Google scraping)',
          timestamp: new Date().toISOString()
        });
      }

      console.log('Resultados finales parseados:', results);
      return results;
    } catch (error) {
      console.error('Error parseando resultados de Google:', error);
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
