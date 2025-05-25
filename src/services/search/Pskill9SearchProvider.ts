
import { SearchProviderBase } from './SearchProviderBase';
import { SearchResult } from '@/types/chat';

export class Pskill9SearchProvider extends SearchProviderBase {
  async search(query: string): Promise<SearchResult[]> {
    try {
      console.log('Iniciando búsqueda pskill9 para:', query);
      
      const proxyUrl = 'https://corsproxy.io/?';
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=5&hl=es`;
      
      const response = await fetch(`${proxyUrl}${encodeURIComponent(searchUrl)}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      if (!response.ok) {
        console.error('Error en respuesta pskill9:', response.status, response.statusText);
        throw new Error(`Búsqueda falló: ${response.status}`);
      }

      const html = await response.text();
      console.log('HTML recibido, longitud:', html.length);
      
      const results = this.parseGoogleResults(html, query);
      console.log('Resultados parseados pskill9:', results);
      
      return results;
    } catch (error) {
      console.error('Error en pskill9 search:', error);
      return [];
    }
  }

  private parseGoogleResults(html: string, query: string): SearchResult[] {
    const results: SearchResult[] = [];
    
    try {
      const titleRegex = /<h3[^>]*class="[^"]*LC20lb[^"]*"[^>]*>([^<]+)<\/h3>/g;
      const linkRegex = /<a[^>]*href="([^"]*)"[^>]*>[\s\S]*?<h3/g;
      const snippetRegex = /<span[^>]*class="[^"]*VwiC3b[^"]*"[^>]*>([^<]+)<\/span>/g;
      
      let titleMatch;
      let titleMatches = [];
      while ((titleMatch = titleRegex.exec(html)) !== null) {
        titleMatches.push(titleMatch[1]);
      }

      let linkMatch;
      let linkMatches = [];
      while ((linkMatch = linkRegex.exec(html)) !== null) {
        if (!linkMatch[1].includes('google.com') && !linkMatch[1].startsWith('/')) {
          linkMatches.push(linkMatch[1]);
        }
      }

      let snippetMatch;
      let snippetMatches = [];
      while ((snippetMatch = snippetRegex.exec(html)) !== null) {
        snippetMatches.push(snippetMatch[1]);
      }

      console.log('Títulos encontrados:', titleMatches.length);
      console.log('Enlaces encontrados:', linkMatches.length);
      console.log('Snippets encontrados:', snippetMatches.length);

      const maxResults = Math.min(titleMatches.length, 3);
      for (let i = 0; i < maxResults; i++) {
        results.push(this.createSearchResult(
          titleMatches[i] || `Resultado ${i + 1} para: ${query}`,
          snippetMatches[i] || 'Snippet no disponible',
          linkMatches[i] || `https://www.google.com/search?q=${encodeURIComponent(query)}`,
          'pskill9/web-search (Google scraping)'
        ));
      }

      console.log('Resultados finales parseados:', results);
      return results;
    } catch (error) {
      console.error('Error parseando resultados de Google:', error);
      return [];
    }
  }
}
