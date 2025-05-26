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
      // Mejorar detección de búsquedas - ser más agresivo
      const shouldSearch = this.shouldPerformSearch(message);
      const timeQuery = this.extractTimeIntent(message);
      
      let searchResults: any[] = [];
      let toolResults: any[] = [];

      console.log('Análisis del mensaje:', {
        message,
        shouldSearch,
        enableWebSearch: this.config.enableWebSearch,
        provider: this.config.webSearchProvider
      });

      // Realizar búsquedas web si se detecta cualquier tipo de consulta
      if (shouldSearch && this.config.enableWebSearch) {
        console.log('🔍 EJECUTANDO BÚSQUEDA WEB para:', message);
        searchResults = await this.performWebSearch(message);
        console.log('📊 Resultados obtenidos:', searchResults.length);
      }

      // Manejar consultas de tiempo
      if (timeQuery && this.config.enableTimeServer) {
        toolResults = await this.handleTimeQuery(timeQuery);
      }

      // Construir prompt mejorado
      const enhancedPrompt = this.buildEnhancedPrompt(message, searchResults, toolResults);

      const messages = [
        {
          role: 'system',
          content: `Eres un asistente inteligente con acceso a herramientas de búsqueda web y tiempo en tiempo real.

INSTRUCCIONES CRÍTICAS:
1. Si tienes resultados de búsqueda, ÚSALOS SIEMPRE como fuente principal
2. MENCIONA SIEMPRE las fuentes (URLs) cuando uses información de búsqueda
3. INDICA el proveedor de búsqueda usado (${this.config.webSearchProvider})
4. Si NO tienes resultados de búsqueda para una consulta que requiere información actualizada, dilo claramente
5. Responde SIEMPRE en español

Herramientas disponibles: ${this.availableTools.map(t => t.name).join(', ')}`
        },
        ...conversationHistory.slice(-6).map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        {
          role: 'user',
          content: enhancedPrompt
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
          temperature: 0.3,
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

  private shouldPerformSearch(message: string): boolean {
    const messageLower = message.toLowerCase();
    
    // Palabras clave de búsqueda más amplias
    const searchKeywords = [
      'busca', 'buscar', 'encuentra', 'encontrar', 'información',
      'qué es', 'quién es', 'cuál es', 'cómo', 'dónde', 'cuándo', 'por qué',
      'dame', 'dime', 'explícame', 'cuéntame', 'detalles', 'noticias',
      'últimas', 'actualidad', 'precio', 'cotización', 'claude', 'gpt',
      'inteligencia artificial', 'ia', 'tecnología', 'empresa', 'producto'
    ];

    // Si contiene palabras clave de búsqueda
    const hasSearchKeywords = searchKeywords.some(keyword => messageLower.includes(keyword));
    
    // Si contiene preguntas
    const hasQuestionWords = messageLower.includes('?') || 
                           messageLower.startsWith('qué') ||
                           messageLower.startsWith('quién') ||
                           messageLower.startsWith('cuál') ||
                           messageLower.startsWith('cómo') ||
                           messageLower.startsWith('dónde') ||
                           messageLower.startsWith('cuándo') ||
                           messageLower.startsWith('por qué');

    // Si menciona nombres específicos (probablemente necesita búsqueda)
    const mentionsSpecificNames = /\b(claude|gpt|openai|anthropic|microsoft|google|apple|tesla|bitcoin|ethereum)\b/i.test(message);

    const shouldSearch = hasSearchKeywords || hasQuestionWords || mentionsSpecificNames;
    
    console.log('🔍 Análisis de búsqueda:', {
      message: messageLower,
      hasSearchKeywords,
      hasQuestionWords,
      mentionsSpecificNames,
      shouldSearch
    });

    return shouldSearch;
  }

  private buildEnhancedPrompt(message: string, searchResults: any[], toolResults: any[]): string {
    let prompt = message;

    if (searchResults.length > 0) {
      prompt += `\n\n📊 RESULTADOS DE BÚSQUEDA WEB REAL (${this.config?.webSearchProvider}):\n`;
      searchResults.forEach((result, index) => {
        prompt += `\n${index + 1}. ${result.title}\n`;
        prompt += `   📍 Fuente: ${result.url}\n`;
        prompt += `   💬 Contenido: ${result.snippet || result.content}\n`;
        prompt += `   🔧 Proveedor: ${result.provider}\n`;
      });
      prompt += '\n⚠️ IMPORTANTE: Usa esta información de búsqueda para responder y SIEMPRE menciona las fuentes específicas.\n';
    }

    if (toolResults.length > 0) {
      prompt += `\n\n🛠️ HERRAMIENTAS MCP UTILIZADAS:\n${JSON.stringify(toolResults, null, 2)}\n`;
    }

    return prompt;
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

  private async performWebSearch(query: string): Promise<any[]> {
    if (!this.config) return [];

    try {
      console.log(`🌐 Ejecutando búsqueda ${this.config.webSearchProvider} para: "${query}"`);

      switch (this.config.webSearchProvider) {
        case 'brave':
          return await this.performBraveSearch(query);
        case 'pskill9':
          return await this.performAlternativeSearch(query);
        case 'docker':
          return await this.performDockerSearch(query);
        default:
          console.warn('Proveedor de búsqueda desconocido');
          return [];
      }
    } catch (error) {
      console.error('❌ Error en búsqueda web:', error);
      return [];
    }
  }

  private async performBraveSearch(query: string): Promise<any[]> {
    if (!this.config?.braveApiKey) {
      console.warn('❌ Clave API de Brave no configurada');
      return [];
    }

    try {
      console.log('🚀 Iniciando búsqueda Brave para:', query);
      
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
        console.error('❌ Error en Brave API:', response.status, response.statusText);
        throw new Error(`Error en Brave API: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Respuesta Brave API recibida');
      
      const results = data.web?.results?.map((result: any, index: number) => ({
        title: result.title || `Resultado ${index + 1}`,
        snippet: result.description || 'Sin descripción disponible',
        url: result.url || 'URL no disponible',
        content: result.description || 'Contenido no disponible',
        provider: 'Brave Search API',
        timestamp: new Date().toISOString()
      })) || [];

      console.log(`✅ ${results.length} resultados Brave procesados`);
      return results;
    } catch (error) {
      console.error('❌ Error en Brave search:', error);
      return [];
    }
  }

  private async performAlternativeSearch(query: string): Promise<any[]> {
    try {
      console.log('🔄 Usando búsqueda alternativa (simulada) para:', query);
      
      // Simular resultados de búsqueda relevantes para demostración
      const simulatedResults = [
        {
          title: `Información sobre: ${query}`,
          snippet: `Resultados de búsqueda simulados para "${query}". En un entorno real, esto contendría información actual de internet.`,
          url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
          content: `Contenido simulado relacionado con ${query}`,
          provider: 'Búsqueda simulada (pskill9)',
          timestamp: new Date().toISOString()
        }
      ];

      console.log('✅ Resultados simulados generados');
      return simulatedResults;
    } catch (error) {
      console.error('❌ Error en búsqueda alternativa:', error);
      return [];
    }
  }

  private async performDockerSearch(query: string): Promise<any[]> {
    try {
      console.log('🐳 Búsqueda Docker MCP simulada para:', query);
      return [];
    } catch (error) {
      console.error('❌ Error en Docker search:', error);
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
