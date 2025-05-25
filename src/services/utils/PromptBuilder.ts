
import { Config, Message } from '@/types/chat';

export class PromptBuilder {
  constructor(private config: Config) {}

  buildSystemPrompt(searchResults: any[], toolResults: any[]): string {
    let systemPrompt = `Eres un asistente de chat inteligente que responde de manera precisa y útil.

INSTRUCCIONES CRÍTICAS:
1. Si tienes resultados de búsqueda web, ÚSALOS EXCLUSIVAMENTE para responder
2. SIEMPRE cita las fuentes específicas usando [Fuente: URL]
3. SIEMPRE menciona la herramienta utilizada (${this.config.webSearchProvider} Web Search, Time MCP, etc.)
4. NO inventes información si no tienes datos de búsqueda
5. Sé conciso pero completo en tus respuestas
6. Responde SIEMPRE en español`;

    if (searchResults.length > 0) {
      systemPrompt += `\n\nTIENES ACCESO A ESTOS RESULTADOS DE BÚSQUEDA WEB REALES:
Proveedor: ${this.config.webSearchProvider}
Número de resultados: ${searchResults.length}
Estado: Información actualizada en tiempo real

IMPORTANTE: Basa tu respuesta EXCLUSIVAMENTE en estos resultados de búsqueda.`;
    }

    if (toolResults.length > 0) {
      systemPrompt += `\n\nHERRAMIENTAS MCP UTILIZADAS:
${toolResults.map(tool => `- ${tool.tool}: ${tool.result}`).join('\n')}`;
    }

    return systemPrompt;
  }

  buildUserPrompt(message: string, searchResults: any[], toolResults: any[]): string {
    let userPrompt = `Pregunta del usuario: ${message}`;

    if (searchResults.length > 0) {
      userPrompt += `\n\n=== RESULTADOS DE BÚSQUEDA WEB (${this.config.webSearchProvider}) ===\n`;
      searchResults.forEach((result, index) => {
        userPrompt += `\nResultado ${index + 1}:
Título: ${result.title}
URL: ${result.url}
Contenido: ${result.snippet || result.content}
Proveedor: ${result.provider}
Timestamp: ${result.timestamp}
---`;
      });
      userPrompt += `\n\nIMPORTANTE: Usa SOLO esta información para responder. Cita las fuentes específicas.`;
    }

    if (toolResults.length > 0) {
      userPrompt += `\n\n=== RESULTADOS DE HERRAMIENTAS MCP ===\n`;
      toolResults.forEach((tool, index) => {
        userPrompt += `Herramienta ${index + 1}: ${tool.tool}
Resultado: ${tool.result}
Detalles: ${tool.details}
---`;
      });
    }

    if (searchResults.length === 0 && toolResults.length === 0) {
      userPrompt += `\n\nNOTA: No se realizaron búsquedas web ni se usaron herramientas MCP para esta consulta.`;
    }

    return userPrompt;
  }

  buildMessagesArray(conversationHistory: Message[], message: string, searchResults: any[], toolResults: any[]): any[] {
    return [
      {
        role: 'system',
        content: this.buildSystemPrompt(searchResults, toolResults)
      },
      ...conversationHistory.slice(-4).map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user',
        content: this.buildUserPrompt(message, searchResults, toolResults)
      }
    ];
  }
}
