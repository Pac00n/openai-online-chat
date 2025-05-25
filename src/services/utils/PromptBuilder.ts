
import { Config, Message } from '@/types/chat';

export class PromptBuilder {
  constructor(private config: Config) {}

  buildSystemPrompt(searchResults: any[], toolResults: any[]): string {
    let systemPrompt = `Eres un asistente de chat inteligente que responde de manera precisa y útil. Responde SIEMPRE en español.

INSTRUCCIONES CRÍTICAS:
1. Si tienes resultados de búsqueda web, ÚSALOS EXCLUSIVAMENTE para responder
2. NUNCA digas que no puedes buscar información - si tienes resultados de búsqueda, úsalos
3. SIEMPRE cita las fuentes específicas usando [Fuente: URL]
4. SIEMPRE menciona la herramienta utilizada (${this.config.webSearchProvider} Web Search, Time MCP, etc.)
5. Sé conciso pero completo en tus respuestas
6. Si no tienes resultados de búsqueda, di claramente que no se realizó búsqueda web`;

    if (searchResults.length > 0) {
      systemPrompt += `\n\n🔍 TIENES RESULTADOS DE BÚSQUEDA WEB ACTUALIZADOS:
Proveedor: ${this.config.webSearchProvider}
Número de resultados: ${searchResults.length}
Estado: Información en tiempo real disponible

IMPORTANTE: 
- Basa tu respuesta EXCLUSIVAMENTE en estos resultados de búsqueda
- Cita las fuentes específicas con [Fuente: URL]
- Menciona que la información proviene de ${this.config.webSearchProvider} Web Search
- NO inventes información adicional`;
    }

    if (toolResults.length > 0) {
      systemPrompt += `\n\n⚡ HERRAMIENTAS MCP UTILIZADAS:
${toolResults.map(tool => `- ${tool.tool}: ${tool.result}`).join('\n')}`;
    }

    return systemPrompt;
  }

  buildUserPrompt(message: string, searchResults: any[], toolResults: any[]): string {
    let userPrompt = `Pregunta del usuario: ${message}`;

    if (searchResults.length > 0) {
      userPrompt += `\n\n=== RESULTADOS DE BÚSQUEDA WEB REAL (${this.config.webSearchProvider}) ===\n`;
      searchResults.forEach((result, index) => {
        userPrompt += `\nResultado ${index + 1}:
Título: ${result.title}
URL: ${result.url}
Contenido: ${result.snippet || result.content}
Proveedor: ${result.provider}
Timestamp: ${result.timestamp}
---`;
      });
      userPrompt += `\n\nIMPORTANTE: 
- Responde basándote SOLO en esta información de búsqueda web
- Cita las fuentes específicas con [Fuente: URL]
- Menciona que usaste ${this.config.webSearchProvider} Web Search
- Resume y sintetiza la información de manera útil`;
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
      userPrompt += `\n\nNOTA: No se realizaron búsquedas web ni se usaron herramientas MCP para esta consulta. Responde con tu conocimiento general.`;
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
