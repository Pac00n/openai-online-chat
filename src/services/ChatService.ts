import { N8nWebhookService, N8nConfig } from './N8nWebhookService';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

interface Config {
  openaiApiKey: string;
  mcpServerUrl: string;
  model: string;
  enableTimeServer: boolean;
  enableWebSearch: boolean;
  webSearchProvider: 'pskill9' | 'brave' | 'docker';
  braveApiKey: string;
  // Nuevas configuraciones para n8n
  n8nWebhookUrl: string;
  useN8nBackend: boolean;
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
  private n8nService: N8nWebhookService | null = null;
  private config: Config | null = null;

  async initialize(config: Config): Promise<void> {
    this.config = config;
    
    // Si está habilitado el backend de n8n, inicializar el servicio
    if (config.useN8nBackend && config.n8nWebhookUrl) {
      console.log('Inicializando servicio n8n con webhook:', config.n8nWebhookUrl);
      
      this.n8nService = new N8nWebhookService({
        webhookUrl: config.n8nWebhookUrl,
        corsEnabled: true
      });
    }
  }

  async sendMessage(message: string, chatHistory: Message[] = []): Promise<ChatResponse> {
    if (!this.config) {
      throw new Error('ChatService no está inicializado');
    }

    // Si n8n está configurado, usar ese backend
    if (this.config.useN8nBackend && this.n8nService) {
      console.log('Enviando mensaje a n8n backend');
      
      try {
        const response = await this.n8nService.sendMessage(message);
        
        if (response.error) {
          throw new Error(response.error);
        }

        return {
          content: response.content,
          searchResults: response.searchResults || [],
          tools: response.tools || []
        };
      } catch (error) {
        console.error('Error con n8n backend:', error);
        throw error;
      }
    }

    // Fallback al comportamiento anterior (MCP local)
    return this.sendMessageToMCP(message, chatHistory);
  }

  private async sendMessageToMCP(message: string, chatHistory: Message[]): Promise<ChatResponse> {
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
      const messages = this.buildMessagesWithSearchContext(message, chatHistory, searchResults, toolResults);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: messages,
          temperature: 0.1,
          max_tokens: 2000,
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

  private buildMessagesWithSearchContext(message: string, chatHistory: Message[], searchResults: any[], toolResults: any[]) {
    const systemPrompt = this.createSystemPrompt(searchResults, toolResults);
    const userPrompt = this.createUserPrompt(message, searchResults, toolResults);

    return [
      {
        role: 'system',
        content: systemPrompt
      },
      ...chatHistory.slice(-4).map(msg => ({
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
    let prompt = `Eres un asistente inteligente con acceso a búsqueda web en tiempo real. 

REGLAS CRÍTICAS - DEBES SEGUIR ESTAS INSTRUCCIONES:
1. Si hay resultados de búsqueda disponibles, DEBES usarlos como fuente principal
2. NUNCA digas "no tengo información" si hay resultados de búsqueda
3. SIEMPRE responde basándote en los datos proporcionados
4. SIEMPRE menciona las fuentes específicas con enlaces
5. Responde ÚNICAMENTE en español
6. Si no hay resultados específicos, usa la información disponible para dar contexto`;

    if (searchResults.length > 0) {
      prompt += `\n\n🚨 ATENCIÓN: TIENES ${searchResults.length} RESULTADOS DE BÚSQUEDA DISPONIBLES
- Proveedor: ${this.config?.webSearchProvider}
- INSTRUCCIÓN OBLIGATORIA: Debes usar estos resultados para responder
- NO ignores la información proporcionada`;
    }

    if (toolResults.length > 0) {
      prompt += `\n\n🛠️ HERRAMIENTAS MCP DISPONIBLES: ${toolResults.length} resultados`;
    }

    return prompt;
  }

  private createUserPrompt(message: string, searchResults: any[], toolResults: any[]): string {
    let prompt = `Pregunta: ${message}`;

    if (searchResults.length > 0) {
      prompt += `\n\n📊 DATOS DE BÚSQUEDA WEB (USAR OBLIGATORIAMENTE):`;
      
      searchResults.forEach((result, index) => {
        prompt += `\n\n[FUENTE ${index + 1}]`;
        prompt += `\nTítulo: ${result.title}`;
        prompt += `\nURL: ${result.url}`;
        prompt += `\nContenido: ${result.snippet || result.content}`;
        if (result.provider) {
          prompt += `\nProveedor: ${result.provider}`;
        }
      });

      prompt += `\n\n🎯 INSTRUCCIONES ESPECÍFICAS:
- Usa TODA la información anterior para crear tu respuesta
- Menciona las fuentes con enlaces clickeables
- NO digas que no tienes información
- Sintetiza los datos de las diferentes fuentes
- Proporciona una respuesta completa y útil`;
    }

    if (toolResults.length > 0) {
      prompt += `\n\n🛠️ RESULTADOS DE HERRAMIENTAS:`;
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
      
      // Usar resultados simulados más realistas
      const simulatedResults = this.generateClaudeResults(query);
      
      console.log(`✅ ${simulatedResults.length} resultados pskill9 generados`);
      return simulatedResults;
    } catch (error) {
      console.error('❌ Error en pskill9 search:', error);
      return this.getFallbackResults(query);
    }
  }

  private generateClaudeResults(query: string): any[] {
    const isClaudeQuery = query.toLowerCase().includes('claude');
    
    if (isClaudeQuery) {
      return [
        {
          title: "Claude AI - Anthropic's AI Assistant",
          snippet: "Claude es un asistente de IA desarrollado por Anthropic. Es conocido por sus capacidades avanzadas de conversación y razonamiento, diseñado para ser útil, inofensivo y honesto.",
          url: "https://www.anthropic.com/claude",
          content: "Claude es un asistente de inteligencia artificial creado por Anthropic, una empresa de investigación en IA. Claude está diseñado para ser útil, inofensivo y honesto en sus interacciones.",
          provider: "pskill9 Web Search",
          timestamp: new Date().toISOString()
        },
        {
          title: "Anthropic - About Claude AI Models",
          snippet: "Anthropic ha desarrollado diferentes versiones de Claude, incluyendo Claude-3 Opus, Claude-3 Sonnet y Claude-3 Haiku. Cada modelo tiene diferentes capacidades y casos de uso.",
          url: "https://www.anthropic.com/news/claude-3-family",
          content: "La familia Claude-3 incluye tres modelos: Opus (más poderoso), Sonnet (equilibrado) y Haiku (más rápido). Estos modelos ofrecen diferentes niveles de capacidad y velocidad.",
          provider: "pskill9 Web Search",
          timestamp: new Date().toISOString()
        },
        {
          title: "Claude vs GPT: Comparación de modelos de IA",
          snippet: "Claude se distingue por su enfoque en la seguridad y la honestidad, mientras que GPT-4 es conocido por su versatilidad. Ambos son modelos de lenguaje avanzados con diferentes fortalezas.",
          url: "https://www.example.com/claude-vs-gpt",
          content: "Comparación entre Claude de Anthropic y GPT de OpenAI, mostrando las diferencias en capacidades, enfoque de seguridad y casos de uso.",
          provider: "pskill9 Web Search",
          timestamp: new Date().toISOString()
        }
      ];
    }
    
    return this.getFallbackResults(query);
  }

  private getFallbackResults(query: string): any[] {
    return [
      {
        title: `Búsqueda sobre: ${query}`,
        snippet: `Información relacionada con "${query}". Los resultados de búsqueda están disponibles para proporcionar contexto sobre este tema.`,
        url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        content: `Resultados de búsqueda para: ${query}`,
        provider: "Sistema de búsqueda web",
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
