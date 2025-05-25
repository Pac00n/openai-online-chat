
import React from 'react';
import { User, Bot, ExternalLink, Clock, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  searchResults?: any[];
  tools?: any[];
}

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-6 animate-fade-in`}>
      <div className={`flex gap-4 max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar with gradient */}
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg ${
          isUser 
            ? 'bg-gradient-to-br from-blue-500 to-purple-600' 
            : 'bg-gradient-to-br from-emerald-500 to-teal-600'
        }`}>
          {isUser ? (
            <User className="w-5 h-5 text-white" />
          ) : (
            <Bot className="w-5 h-5 text-white" />
          )}
        </div>

        {/* Message Content */}
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
          <div className={`rounded-2xl p-4 shadow-md transition-all duration-300 hover:shadow-lg ${
            isUser 
              ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white' 
              : 'bg-white border border-gray-100 text-gray-800'
          }`}>
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {message.content}
            </div>
          </div>

          {/* Tool Results */}
          {message.tools && message.tools.length > 0 && (
            <Card className="mt-3 w-full bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-800">
                    Herramientas MCP
                  </span>
                  <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">
                    {message.tools.length}
                  </Badge>
                </div>
                <div className="space-y-3">
                  {message.tools.map((tool, index) => (
                    <div key={index} className="p-3 bg-white/60 backdrop-blur-sm rounded-lg border border-amber-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-amber-600" />
                        <div className="font-medium text-amber-900 text-sm">
                          {tool.tool || 'Herramienta MCP'}
                        </div>
                      </div>
                      <div className="text-amber-800 text-xs">
                        {tool.result || tool.details || 'Resultado de herramienta MCP'}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Search Results */}
          {message.searchResults && message.searchResults.length > 0 && (
            <Card className="mt-3 w-full bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <ExternalLink className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-800">
                    Resultados de búsqueda
                  </span>
                  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                    {message.searchResults.length}
                  </Badge>
                </div>
                <div className="space-y-3">
                  {message.searchResults.slice(0, 3).map((result, index) => (
                    <div key={index} className="p-3 bg-white/60 backdrop-blur-sm rounded-lg border border-blue-200">
                      <div className="font-medium text-blue-900 mb-2 text-sm">
                        {result.title || 'Resultado ' + (index + 1)}
                      </div>
                      <div className="text-blue-700 line-clamp-2 text-xs mb-2">
                        {result.snippet || result.content || 'Contenido de búsqueda'}
                      </div>
                      {result.url && (
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 text-xs transition-colors duration-200"
                        >
                          Ver más
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timestamp */}
          <div className="text-xs text-gray-400 mt-2 transition-opacity duration-200 opacity-70 hover:opacity-100">
            {message.timestamp.toLocaleTimeString('es-ES')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
