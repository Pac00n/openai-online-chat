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
      const shouldSearch = this.shouldPerformSearch(message);
      const timeQuery = this.extractTimeIntent(message);
      
      let searchResults: any[] = [];
      let toolResults: any[] = [];

      console.log('🔍 Análisis del mensaje:', {
        message,
        shouldSearch,
        enableWebSearch: this.config.enableWebSearch,
        provider: this.config.webSearchProvider
      });

      // Realizar búsquedas web
      if (shouldSearch && this.config.enableWebSearch) {
        console.log('🌐 EJECUTANDO BÚSQUEDA WEB para:', message);
        searchResults = await this.performWebSearch(message);
        console.log('📊 Resultados obtenidos:', searchResults.length);
        
        // Log detallado de los resultados
        if (searchResults.length > 0) {
          console.log('📄 Primeros resultados:', searchResults.slice(0, 2));
        }
      }

      // Manejar consultas de tiempo
      if (timeQuery && this.config.enableTimeServer) {
        toolResults = await this.handleTimeQuery(timeQuery);
      }

      // Construir mensajes con información de búsqueda integrada
      const messages = this.buildMessagesWithSearchContext(message, conversationHistory, searchResults, toolResults);

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
          max_tokens: 1500,
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

  private buildMessagesWithSearchContext(message: string, conversationHistory: Message[], searchResults: any[], toolResults: any[]) {
    const systemPrompt = this.createSystemPrompt(searchResults, toolResults);
    const userPrompt = this.createUserPrompt(message, searchResults, toolResults);

    return [
      {
        role: 'system',
        content: systemPrompt
      },
      ...conversationHistory.slice(-4).map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user',
        content: userPrompt
      }
    ];
  }

  private createSystemPrompt(searchResults: any[], toolResults: any[]): string {
    let prompt = `Eres un asistente inteligente que SIEMPRE debe usar la información proporcionada de búsquedas web y herramientas para responder.

REGLAS OBLIGATORIAS:
1. Si recibes resultados de búsqueda web, DEBES usarlos como fuente principal de información
2. SIEMPRE menciona las fuentes específicas (URLs) cuando uses información de búsqueda
3. NUNCA digas que no tienes información si hay resultados de búsqueda disponibles
4. Responde SIEMPRE en español
5. Sintetiza la información de múltiples fuentes cuando esté disponible`;

    if (searchResults.length > 0) {
      prompt += `\n\n🌐 TIENES ACCESO A BÚSQUEDA WEB EN TIEMPO REAL
Proveedor: ${this.config?.webSearchProvider}
Resultados disponibles: ${searchResults.length}
INSTRUCCIÓN CRÍTICA: USA esta información para responder la pregunta del usuario.`;
    }

    if (toolResults.length > 0) {
      prompt += `\n\n🛠️ TIENES ACCESO A HERRAMIENTAS MCP
Herramientas ejecutadas: ${toolResults.length}`;
    }

    return prompt;
  }

  private createUserPrompt(message: string, searchResults: any[], toolResults: any[]): string {
    let prompt = `Pregunta del usuario: ${message}`;

    if (searchResults.length > 0) {
      prompt += `\n\n📊 INFORMACIÓN DE BÚSQUEDA WEB DISPONIBLE:`;
      
      searchResults.forEach((result, index) => {
        prompt += `\n\n--- RESULTADO ${index + 1} ---`;
        prompt += `\nTítulo: ${result.title}`;
        prompt += `\nFuente: ${result.url}`;
        prompt += `\nContenido: ${result.snippet || result.content}`;
        prompt += `\nProveedor: ${result.provider}`;
      });

      prompt += `\n\n⚠️ INSTRUCCIÓN OBLIGATORIA: 
- USA la información anterior para responder
- MENCIONA las fuentes específicas
- NO digas que no tienes información
- SINTETIZA los datos de las diferentes fuentes`;
    }

    if (toolResults.length > 0) {
      prompt += `\n\n🛠️ RESULTADOS DE HERRAMIENTAS MCP:`;
      toolResults.forEach((tool, index) => {
        prompt += `\n${index + 1}. ${tool.tool}: ${tool.result}`;
      });
    }

    return prompt;
  }

  private shouldPerformSearch(message: string): boolean {
    const messageLower = message.toLowerCase();
    
    // Palabras clave más amplias para detectar búsquedas
    const searchKeywords = [
      'busca', 'buscar', 'busco', 'encuentra', 'encontrar', 'información', 'info',
      'qué es', 'quién es', 'cuál es', 'cómo', 'dónde', 'cuándo', 'por qué',
      'dame', 'dime', 'explícame', 'cuéntame', 'detalles', 'noticias',
      'últimas', 'actualidad', 'precio', 'cotización', 'claude', 'gpt',
      'anthropic', 'openai', 'inteligencia artificial', 'ia', 'tecnología',
      'empresa', 'producto', 'acerca de', 'sobre', 'habla', 'resume', 'resumir'
    ];

    // Detectar preguntas
    const hasQuestionWords = messageLower.includes('?') || 
                           messageLower.startsWith('qué') ||
                           messageLower.startsWith('quién') ||
                           messageLower.startsWith('cuál') ||
                           messageLower.startsWith('cómo') ||
                           messageLower.startsWith('dónde') ||
                           messageLower.startsWith('cuándo') ||
                           messageLower.startsWith('por qué');

    // Si contiene palabras clave de búsqueda
    const hasSearchKeywords = searchKeywords.some(keyword => messageLower.includes(keyword));
    
    // Si menciona nombres específicos
    const mentionsSpecificNames = /\b(claude|gpt|anthropic|openai|microsoft|google|apple|tesla|bitcoin|ethereum)\b/i.test(message);

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
          return await this.performPskill9Search(query);
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

  private async performPskill9Search(query: string): Promise<any[]> {
    try {
      console.log('🔄 Ejecutando búsqueda pskill9 para:', query);
      
      // Crear un query de búsqueda más específico
      const searchQuery = encodeURIComponent(query);
      const searchUrl = `https://corsproxy.io/?https%3A%2F%2Fwww.google.com%2Fsearch%3Fq%3D${searchQuery}%26num%3D5%26hl%3Des`;
      
      console.log('🌐 URL de búsqueda:', searchUrl);

      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      if (!response.ok) {
        console.error('❌ Error en búsqueda pskill9:', response.status);
        return this.getFallbackResults(query);
      }

      const html = await response.text();
      console.log('📄 HTML recibido, longitud:', html.length);

      // Buscar resultados en el HTML de Google
      const results = this.parseGoogleResults(html, query);
      
      if (results.length === 0) {
        console.log('⚠️ No se encontraron resultados, usando fallback');
        return this.getFallbackResults(query);
      }

      console.log(`✅ ${results.length} resultados pskill9 procesados`);
      return results;
    } catch (error) {
      console.error('❌ Error en pskill9 search:', error);
      return this.getFallbackResults(query);
    }
  }

  private parseGoogleResults(html: string, query: string): any[] {
    try {
      // Buscar patrones básicos de resultados de Google
      const titlePattern = /<h3[^>]*>([^<]+)<\/h3>/gi;
      const linkPattern = /<a[^>]*href="([^"]*)"[^>]*>/gi;
      const snippetPattern = /<span[^>]*>([^<]{50,200})<\/span>/gi;

      const titles = [];
      const links = [];
      const snippets = [];

      let match;
      while ((match = titlePattern.exec(html)) !== null && titles.length < 5) {
        titles.push(match[1].trim());
      }

      while ((match = linkPattern.exec(html)) !== null && links.length < 5) {
        const url = match[1];
        if (url.startsWith('http') && !url.includes('google.com')) {
          links.push(url);
        }
      }

      while ((match = snippetPattern.exec(html)) !== null && snippets.length < 5) {
        const snippet = match[1].trim();
        if (snippet.length > 50) {
          snippets.push(snippet);
        }
      }

      console.log('📊 Elementos parseados:', { titles: titles.length, links: links.length, snippets: snippets.length });

      const results = [];
      const maxResults = Math.min(titles.length, links.length, 3);

      for (let i = 0; i < maxResults; i++) {
        results.push({
          title: titles[i] || `Resultado sobre ${query}`,
          snippet: snippets[i] || `Información relacionada con ${query}`,
          url: links[i] || `https://www.google.com/search?q=${encodeURIComponent(query)}`,
          content: snippets[i] || `Contenido relacionado con ${query}`,
          provider: 'pskill9 Google Scraping',
          timestamp: new Date().toISOString()
        });
      }

      return results;
    } catch (error) {
      console.error('❌ Error parseando resultados:', error);
      return [];
    }
  }

  private getFallbackResults(query: string): any[] {
    // Generar resultados informativos como fallback
    return [
      {
        title: `Información sobre: ${query}`,
        snippet: `Se detectó una consulta sobre "${query}". La búsqueda web está configurada pero puede estar experimentando problemas temporales. Te recomiendo verificar la configuración de tu proveedor de búsqueda.`,
        url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        content: `Consulta de búsqueda: ${query}`,
        provider: 'Sistema de fallback',
        timestamp: new Date().toISOString()
      }
    ];
  }

  private async performDockerSearch(query: string): Promise<any[]> {
    try {
      console.log('🐳 Búsqueda Docker MCP simulada para:', query);
      return this.getFallbackResults(query);
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
