
export interface Config {
  openaiApiKey: string;
  mcpServerUrl: string;
  model: string;
  enableTimeServer: boolean;
  enableWebSearch: boolean;
  webSearchProvider: 'pskill9' | 'brave' | 'docker';
  braveApiKey: string;
}

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  searchResults?: any[];
  tools?: any[];
}

export interface ChatResponse {
  content: string;
  searchResults?: any[];
  tools?: any[];
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  content: string;
  provider: string;
  timestamp: string;
}
