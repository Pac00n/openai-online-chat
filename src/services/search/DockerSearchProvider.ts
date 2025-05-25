
import { SearchProviderBase } from './SearchProviderBase';
import { SearchResult } from '@/types/chat';

export class DockerSearchProvider extends SearchProviderBase {
  async search(query: string): Promise<SearchResult[]> {
    try {
      console.log('Búsqueda Docker MCP simulada para:', query);
      // Por ahora retornar vacío hasta implementar servidor real
      return [];
    } catch (error) {
      console.error('Error en Docker search:', error);
      return [];
    }
  }
}
