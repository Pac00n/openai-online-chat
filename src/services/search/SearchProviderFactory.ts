
import { Config } from '@/types/chat';
import { SearchProviderBase } from './SearchProviderBase';
import { Pskill9SearchProvider } from './Pskill9SearchProvider';
import { BraveSearchProvider } from './BraveSearchProvider';
import { DockerSearchProvider } from './DockerSearchProvider';

export class SearchProviderFactory {
  static createProvider(config: Config): SearchProviderBase {
    switch (config.webSearchProvider) {
      case 'pskill9':
        return new Pskill9SearchProvider();
      case 'brave':
        return new BraveSearchProvider(config.braveApiKey);
      case 'docker':
        return new DockerSearchProvider();
      default:
        throw new Error(`Proveedor de búsqueda desconocido: ${config.webSearchProvider}`);
    }
  }
}
