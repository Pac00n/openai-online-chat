
import { Config, MCPTool } from '@/types/chat';

export class WebSearchHandler {
  private availableTools: MCPTool[] = [];

  async initialize(config: Config): Promise<void> {
    let searchTools: MCPTool[] = [];

    switch (config.webSearchProvider) {
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
    console.log(`${config.webSearchProvider} Web Search MCP Server tools initialized:`, searchTools);
  }

  extractSearchIntent(message: string): string | null {
    const messageLower = message.toLowerCase().trim();
    
    // Palabras que indican búsqueda explícita
    const explicitSearchKeywords = [
      'busca', 'buscar', 'busca información', 'busca datos',
      'encuentra', 'encontrar', 'busca noticias', 'busca sobre',
      'información sobre', 'información acerca de', 'datos sobre',
      'noticias sobre', 'noticias de', 'últimas noticias',
      'qué pasó con', 'qué está pasando con', 'actualidad sobre',
      'tendencias de', 'precio de', 'cotización de', 'valor de'
    ];

    // Palabras de consulta general que requieren búsqueda web
    const generalQueryKeywords = [
      'qué es', 'quién es', 'cuál es', 'cómo funciona', 'cómo se hace',
      'dónde está', 'cuándo ocurrió', 'por qué', 'para qué sirve',
      'cuéntame sobre', 'explícame', 'háblame de', 'detalles sobre',
      'características de', 'especificaciones de', 'reviews de',
      'opiniones sobre', 'comparación entre'
    ];

    // Temas que típicamente requieren información actualizada
    const currentTopics = [
      'clima', 'weather', 'tiempo', 'temperatura',
      'noticias', 'news', 'actualidad', 'eventos',
      'precio', 'cotización', 'stock', 'mercado',
      'resultado', 'partido', 'elecciones', 'política'
    ];

    // Verificar si contiene palabras de búsqueda explícita
    const hasExplicitSearch = explicitSearchKeywords.some(keyword => 
      messageLower.includes(keyword)
    );

    // Verificar si es una consulta general que requiere búsqueda
    const hasGeneralQuery = generalQueryKeywords.some(keyword => 
      messageLower.includes(keyword)
    );

    // Verificar si menciona temas que requieren información actualizada
    const hasCurrentTopic = currentTopics.some(topic => 
      messageLower.includes(topic)
    );

    // Verificar si es una pregunta (contiene signos de interrogación o palabras interrogativas)
    const isQuestion = messageLower.includes('?') || 
      /^(qué|quién|cuál|cómo|dónde|cuándo|por qué|para qué)/i.test(messageLower);

    // Verificar si menciona productos, tecnologías, personas o entidades específicas
    const mentionsSpecificEntity = /\b(claude|gpt|openai|microsoft|apple|google|tesla|bitcoin|ethereum)\b/i.test(messageLower) ||
      /\b(iphone|android|windows|linux|mac|ios)\b/i.test(messageLower) ||
      /\b(python|javascript|react|vue|angular|node)\b/i.test(messageLower);

    // Determinar si debe realizar búsqueda
    const shouldSearch = hasExplicitSearch || 
      (hasGeneralQuery && (isQuestion || mentionsSpecificEntity)) ||
      (isQuestion && hasCurrentTopic) ||
      (isQuestion && mentionsSpecificEntity);

    console.log('Análisis de intención de búsqueda:', {
      message: messageLower,
      hasExplicitSearch,
      hasGeneralQuery,
      hasCurrentTopic,
      isQuestion,
      mentionsSpecificEntity,
      shouldSearch
    });

    return shouldSearch ? message : null;
  }

  getAvailableTools(): MCPTool[] {
    return this.availableTools;
  }
}
