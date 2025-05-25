
import { MCPTool } from '@/types/chat';

export class TimeServerHandler {
  private availableTools: MCPTool[] = [];

  async initialize(): Promise<void> {
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

  extractTimeIntent(message: string): string | null {
    const timeKeywords = [
      'hora', 'tiempo', 'reloj', 'horario', 'zona horaria', 'timezone',
      'qué hora es', 'hora actual', 'diferencia horaria', 'tiempo en'
    ];

    const messageLower = message.toLowerCase();
    const hasTimeIntent = timeKeywords.some(keyword => messageLower.includes(keyword));

    return hasTimeIntent ? message : null;
  }

  async handleTimeQuery(query: string): Promise<any[]> {
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

  getAvailableTools(): MCPTool[] {
    return this.availableTools;
  }
}
