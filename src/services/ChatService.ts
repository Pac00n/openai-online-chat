
import { Config, Message, ChatResponse, MCPTool } from '@/types/chat';
import { SearchProviderFactory } from './search/SearchProviderFactory';
import { TimeServerHandler } from './mcp/TimeServerHandler';
import { WebSearchHandler } from './mcp/WebSearchHandler';
import { PromptBuilder } from './utils/PromptBuilder';

export class ChatService {
  private config: Config | null = null;
  private mcpConnection: WebSocket | null = null;
  private timeServerHandler: TimeServerHandler;
  private webSearchHandler: WebSearchHandler;
  private promptBuilder: PromptBuilder | null = null;

  constructor() {
    this.timeServerHandler = new TimeServerHandler();
    this.webSearchHandler = new WebSearchHandler();
  }

  async initialize(config: Config): Promise<void> {
    this.config = config;
    this.promptBuilder = new PromptBuilder(config);
    
    if (config.enableTimeServer) {
      await this.timeServerHandler.initialize();
    }
    
    if (config.enableWebSearch) {
      await this.webSearchHandler.initialize(config);
    }
    
    if (config.mcpServerUrl) {
      await this.connectToMCP();
    }
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
    if (!this.config || !this.promptBuilder) throw new Error('Service not initialized');

    try {
      const searchQuery = this.webSearchHandler.extractSearchIntent(message);
      const timeQuery = this.timeServerHandler.extractTimeIntent(message);
      
      let searchResults: any[] = [];
      let toolResults: any[] = [];

      if (searchQuery && this.config.enableWebSearch) {
        console.log('Realizando búsqueda web real para:', searchQuery);
        searchResults = await this.performWebSearch(searchQuery);
        console.log('Resultados de búsqueda obtenidos:', searchResults);
      }

      if (timeQuery && this.config.enableTimeServer) {
        toolResults = await this.timeServerHandler.handleTimeQuery(timeQuery);
      }

      const messages = this.promptBuilder.buildMessagesArray(
        conversationHistory, 
        message, 
        searchResults, 
        toolResults
      );

      console.log('Sending messages to OpenAI:', messages);

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

  private async performWebSearch(query: string): Promise<any[]> {
    if (!this.config) return [];

    try {
      console.log(`Realizando búsqueda web REAL con ${this.config.webSearchProvider} para: ${query}`);
      
      const searchProvider = SearchProviderFactory.createProvider(this.config);
      return await searchProvider.search(query);
    } catch (error) {
      console.error('Error en búsqueda web:', error);
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
