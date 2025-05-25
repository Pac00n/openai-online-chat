
import { Config, Message } from '@/types/chat';

export class PromptBuilder {
  constructor(private config: Config) {}

  buildSystemPrompt(searchResults: any[], toolResults: any[]): string {
    let systemPrompt = `Eres un asistente de chat inteligente que responde de manera precisa y útil. Responde SIEMPRE en español.

INSTRUCCIONES CRÍTICAS DE BÚSQUEDA WEB:
1. Si tienes resultados de búsqueda web, DEBES USARLOS EXCLUSIVAMENTE para responder
2. NUNCA digas que no puedes buscar - si tienes resultados, úsalos completamente
3. SIEMPRE cita las fuentes específicas usando [Fuente: URL]
4. SIEMPRE menciona que usaste ${this.config.webSearchProvider} Web Search
5. Resume y sintetiza la información de los resultados de búsqueda
6. Sé completo pero conciso en tus respuestas basadas en búsqueda`;

    if (searchResults.length > 0) {
      systemPrompt += `\n\n🔍 TIENES ${searchResults.length} RESULTADOS DE BÚSQUEDA WEB ACTUALIZADOS:
Proveedor: ${this.config.webSearchProvider}
Estado: Información en tiempo real disponible

INSTRUCCIÓN OBLIGATORIA: 
- Basa tu respuesta ÚNICAMENTE en estos resultados de búsqueda
- Cita cada fuente específica con [Fuente: URL]
- Menciona que la información proviene de ${this.config.webSearchProvider} Web Search
- Sintetiza y resume toda la información disponible
- NO digas que no tienes información - la tienes en los resultados`;
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
      userPrompt += `\n\n=== RESULTADOS DE BÚSQUEDA WEB DISPONIBLES (${this.config.webSearchProvider}) ===\n`;
      searchResults.forEach((result, index) => {
        userPrompt += `\nResultado ${index + 1}:
Título: ${result.title || 'Sin título'}
URL: ${result.url || 'URL no disponible'}
Contenido: ${result.snippet || result.content || 'Contenido no disponible'}
Proveedor: ${result.provider || this.config.webSearchProvider}
Timestamp: ${result.timestamp || new Date().toISOString()}
---`;
      });
      userPrompt += `\n\nINSTRUCCIÓN OBLIGATORIA: 
- Responde usando TODA esta información de búsqueda web
- Cita cada fuente específica con [Fuente: URL]
- Menciona que usaste ${this.config.webSearchProvider} Web Search
- Resume y sintetiza TODA la información disponible
- NO digas que no tienes información - la tienes aquí arriba`;
    }

    if (toolResults.length > 0) {
      userPrompt += `\n\n=== RESULTADOS DE HERRAMIENTAS MCP ===\n`;
      toolResults.forEach((tool, index) => {
        userPrompt += `Herramienta ${index + 1}: ${tool.tool}
Resultado: ${tool.result}
Detalles: ${tool.details || 'Sin detalles adicionales'}
---`;
      });
    }

    if (searchResults.length === 0 && toolResults.length === 0) {
      userPrompt += `\n\nNOTA: No se realizaron búsquedas web ni se usaron herramientas MCP para esta consulta. Responde con tu conocimiento general, pero menciona que no tienes información actualizada.`;
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
