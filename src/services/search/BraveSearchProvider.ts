
import { SearchProviderBase } from './SearchProviderBase';
import { SearchResult } from '@/types/chat';

export class BraveSearchProvider extends SearchProviderBase {
  constructor(private apiKey: string) {
    super();
  }

  async search(query: string): Promise<SearchResult[]> {
    if (!this.apiKey) {
      console.warn('Clave API de Brave no configurada');
      return [];
    }

    try {
      console.log('Iniciando búsqueda Brave para:', query);
      
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
          'X-Subscription-Token': this.apiKey
        }
      });

      if (!response.ok) {
        console.error('Error en Brave API:', response.status, response.statusText);
        throw new Error(`Error en Brave API: ${response.status}`);
      }

      const data = await response.json();
      console.log('Respuesta Brave API:', data);
      
      const results = data.web?.results?.map((result: any) => 
        this.createSearchResult(
          result.title || 'Sin título',
          result.description || 'Sin descripción disponible',
          result.url || 'URL no disponible',
          'Brave Search API'
        )
      ) || [];

      console.log('Resultados Brave procesados:', results);
      return results;
    } catch (error) {
      console.error('Error en Brave search:', error);
      return [];
    }
  }
}
