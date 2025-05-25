
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
    const searchKeywords = [
      'busca', 'buscar', 'encuentra', 'encontrar', 'qué es', 'quién es',
      'cuál es', 'cómo', 'dónde', 'cuándo', 'por qué', 'información sobre',
      'noticias', 'últimas', 'actualidad', 'precio', 'cotización', 'tendencias',
      'dame información', 'cuéntame sobre', 'explícame', 'detalles sobre'
    ];

    const messageLower = message.toLowerCase();
    const shouldSearch = searchKeywords.some(keyword => messageLower.includes(keyword)) ||
                        messageLower.includes('?');

    return shouldSearch ? message : null;
  }

  getAvailableTools(): MCPTool[] {
    return this.availableTools;
  }
}
