
import { SearchResult } from '@/types/chat';

export abstract class SearchProviderBase {
  abstract search(query: string): Promise<SearchResult[]>;
  
  protected createSearchResult(
    title: string,
    snippet: string,
    url: string,
    provider: string
  ): SearchResult {
    return {
      title: title || 'Sin título',
      snippet: snippet || 'Sin descripción disponible',
      url: url || '',
      content: snippet || 'Contenido no disponible',
      provider,
      timestamp: new Date().toISOString()
    };
  }
}
