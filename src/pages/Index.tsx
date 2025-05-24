
import React, { useState, useRef, useEffect } from 'react';
import { Send, Settings, Search, MessageCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import ChatMessage from '@/components/ChatMessage';
import ConfigPanel from '@/components/ConfigPanel';
import { ChatService } from '@/services/ChatService';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  searchResults?: any[];
  tools?: any[];
}

interface Config {
  openaiApiKey: string;
  mcpServerUrl: string;
  model: string;
  enableTimeServer: boolean;
}

const Index = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [config, setConfig] = useState<Config>({
    openaiApiKey: localStorage.getItem('openai_api_key') || '',
    mcpServerUrl: localStorage.getItem('mcp_server_url') || '',
    model: 'gpt-4o-mini',
    enableTimeServer: localStorage.getItem('enable_time_server') === 'true'
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatService = useRef(new ChatService());
  const { toast } = useToast();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (config.openaiApiKey) {
      initializeServices();
    }
  }, [config]);

  const initializeServices = async () => {
    try {
      await chatService.current.initialize(config);
      setIsConnected(true);
      toast({
        title: "Conectado",
        description: config.enableTimeServer ? 
          "Servicios inicializados con herramientas MCP Time" : 
          "Servicios inicializados correctamente",
      });
    } catch (error) {
      console.error('Error initializing services:', error);
      setIsConnected(false);
      toast({
        title: "Error de conexión",
        description: "No se pudieron inicializar los servicios",
        variant: "destructive",
      });
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !isConnected) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      role: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await chatService.current.sendMessage(inputMessage, messages);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response.content,
        role: 'assistant',
        timestamp: new Date(),
        searchResults: response.searchResults,
        tools: response.tools
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleConfigSave = (newConfig: Config) => {
    setConfig(newConfig);
    localStorage.setItem('openai_api_key', newConfig.openaiApiKey);
    localStorage.setItem('mcp_server_url', newConfig.mcpServerUrl);
    localStorage.setItem('enable_time_server', newConfig.enableTimeServer.toString());
    setShowConfig(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-scale-in">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl shadow-lg">
              <MessageCircle className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent">
                Chat MCP Pro
              </h1>
              <p className="text-gray-600 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Chat inteligente con herramientas MCP y búsqueda online
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Badge 
              variant={isConnected ? "default" : "destructive"}
              className={isConnected ? 
                "bg-gradient-to-r from-green-500 to-emerald-500 shadow-md" : 
                "bg-gradient-to-r from-red-500 to-rose-500 shadow-md"
              }
            >
              {isConnected ? "Conectado" : "Desconectado"}
            </Badge>
            {config.enableTimeServer && (
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md">
                Time MCP
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfig(!showConfig)}
              className="border-gray-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-200"
            >
              <Settings className="w-4 h-4 mr-2" />
              Configuración
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Configuration Panel */}
          {showConfig && (
            <div className="lg:col-span-1 animate-slide-in-right">
              <ConfigPanel
                config={config}
                onSave={handleConfigSave}
                onClose={() => setShowConfig(false)}
              />
            </div>
          )}

          {/* Chat Area */}
          <div className={`${showConfig ? 'lg:col-span-3' : 'lg:col-span-4'} animate-scale-in`}>
            <Card className="h-[650px] flex flex-col shadow-2xl bg-white/80 backdrop-blur-sm border-0">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-xl">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3">
                    <Search className="w-6 h-6" />
                    Chat con Herramientas MCP
                  </CardTitle>
                  <div className="text-sm opacity-90">
                    {messages.length} mensajes
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col p-0">
                {/* Messages Area */}
                <ScrollArea className="flex-1 p-6">
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-500 mt-12 animate-fade-in">
                      <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
                        <MessageCircle className="w-10 h-10 text-blue-500" />
                      </div>
                      <p className="text-xl font-medium text-gray-700 mb-2">
                        ¡Bienvenido al Chat MCP Pro!
                      </p>
                      <p className="text-sm text-gray-500 mb-4">
                        Haz preguntas sobre tiempo, obtén información actualizada y más
                      </p>
                      <div className="flex flex-wrap justify-center gap-2 text-xs">
                        <span className="bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 px-3 py-1 rounded-full">
                          Preguntas sobre hora
                        </span>
                        <span className="bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 px-3 py-1 rounded-full">
                          Búsquedas online
                        </span>
                        <span className="bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 px-3 py-1 rounded-full">
                          Información general
                        </span>
                      </div>
                      {!isConnected && (
                        <p className="text-red-500 text-sm mt-4 p-3 bg-red-50 rounded-lg mx-auto max-w-md">
                          Configura tu API key para comenzar
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {messages.map((message) => (
                        <ChatMessage key={message.id} message={message} />
                      ))}
                      {isLoading && (
                        <div className="flex justify-start animate-fade-in">
                          <div className="bg-gradient-to-r from-gray-100 to-gray-200 rounded-2xl p-4 shadow-md">
                            <div className="flex items-center gap-3">
                              <div className="w-5 h-5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse"></div>
                              <span className="text-gray-600">Procesando con herramientas MCP...</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </ScrollArea>

                <Separator className="bg-gradient-to-r from-blue-200 to-purple-200" />

                {/* Input Area */}
                <div className="p-6 bg-gradient-to-r from-gray-50 to-slate-50">
                  <div className="flex gap-3">
                    <Input
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder={
                        isConnected 
                          ? "Pregunta sobre la hora, busca información..." 
                          : "Configura las credenciales primero..."
                      }
                      disabled={!isConnected || isLoading}
                      className="flex-1 border-gray-200 focus:border-blue-400 transition-all duration-200 shadow-sm"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!inputMessage.trim() || isLoading || !isConnected}
                      size="sm"
                      className="px-6 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg transition-all duration-200"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="text-xs text-gray-500 mt-3 flex items-center justify-between">
                    <span>Presiona Enter para enviar • Shift+Enter para nueva línea</span>
                    {config.enableTimeServer && (
                      <span className="text-amber-600 font-medium">MCP Time Server activo</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
