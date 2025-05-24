
import React, { useState, useRef, useEffect } from 'react';
import { Send, Settings, Search, MessageCircle } from 'lucide-react';
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
}

interface Config {
  openaiApiKey: string;
  mcpServerUrl: string;
  model: string;
}

const Index = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [config, setConfig] = useState<Config>({
    openaiApiKey: localStorage.getItem('openai_api_key') || '',
    mcpServerUrl: localStorage.getItem('mcp_server_url') || 'ws://localhost:3001',
    model: 'gpt-4o-mini'
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatService = useRef(new ChatService());
  const { toast } = useToast();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (config.openaiApiKey && config.mcpServerUrl) {
      initializeServices();
    }
  }, [config]);

  const initializeServices = async () => {
    try {
      await chatService.current.initialize(config);
      setIsConnected(true);
      toast({
        title: "Conectado",
        description: "Servicios inicializados correctamente",
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
        searchResults: response.searchResults
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
    setShowConfig(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Chat MCP</h1>
              <p className="text-gray-600">Chat inteligente con búsqueda online</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge variant={isConnected ? "default" : "destructive"}>
              {isConnected ? "Conectado" : "Desconectado"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfig(!showConfig)}
            >
              <Settings className="w-4 h-4 mr-2" />
              Configuración
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Configuration Panel */}
          {showConfig && (
            <div className="lg:col-span-1">
              <ConfigPanel
                config={config}
                onSave={handleConfigSave}
                onClose={() => setShowConfig(false)}
              />
            </div>
          )}

          {/* Chat Area */}
          <div className={`${showConfig ? 'lg:col-span-3' : 'lg:col-span-4'}`}>
            <Card className="h-[600px] flex flex-col shadow-lg">
              <CardHeader className="bg-white border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Search className="w-5 h-5 text-blue-600" />
                    Chat con Búsqueda Online
                  </CardTitle>
                  <div className="text-sm text-gray-500">
                    {messages.length} mensajes
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col p-0">
                {/* Messages Area */}
                <ScrollArea className="flex-1 p-4">
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-500 mt-8">
                      <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-lg font-medium">¡Bienvenido al Chat MCP!</p>
                      <p className="text-sm mt-2">
                        Haz preguntas y obtén respuestas con búsquedas online en tiempo real
                      </p>
                      {!isConnected && (
                        <p className="text-red-500 text-sm mt-2">
                          Configura tu API key y servidor MCP para comenzar
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <ChatMessage key={message.id} message={message} />
                      ))}
                      {isLoading && (
                        <div className="flex justify-start">
                          <div className="bg-gray-100 rounded-lg p-3">
                            <div className="flex items-center gap-2">
                              <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                              <span className="text-gray-600">Pensando...</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </ScrollArea>

                <Separator />

                {/* Input Area */}
                <div className="p-4 bg-gray-50">
                  <div className="flex gap-2">
                    <Input
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder={
                        isConnected 
                          ? "Escribe tu mensaje aquí..." 
                          : "Configura las credenciales primero..."
                      }
                      disabled={!isConnected || isLoading}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!inputMessage.trim() || isLoading || !isConnected}
                      size="sm"
                      className="px-4"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    Presiona Enter para enviar • Shift+Enter para nueva línea
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
