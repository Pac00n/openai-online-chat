
import React, { useState, useRef, useEffect } from 'react';
import { Send, Settings, MessageCircle, Sparkles, WifiOff, Wifi } from 'lucide-react'; // Import Wifi, WifiOff
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
  // searchResults e tools podrían ser manejados de forma diferente o eliminados
  // si el backend ahora solo devuelve el contenido final del mensaje.
  // Por ahora los mantenemos por si ChatService los sigue devolviendo.
  searchResults?: any[]; 
  tools?: any[]; 
}

// Interfaz de configuración simplificada para el frontend
interface Config {
  openaiApiKey: string;
  model: string;
  // backendUrl: string; // Podríamos añadir esto si la URL del backend es configurable
}

const Index = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  // isConnected ahora se referirá a la conexión con el backend, no directamente a OpenAI o MCP.
  const [isBackendConnected, setIsBackendConnected] = useState(false); 

  const [config, setConfig] = useState<Config>({
    openaiApiKey: localStorage.getItem('openai_api_key') || '',
    model: localStorage.getItem('openai_model') || 'gpt-4o-mini',
    // backendUrl: localStorage.getItem('backend_url') || 'ws://localhost:3001/chat' // Ejemplo
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  // La URL del backend podría ser una constante o venir de la config.
  // const BACKEND_URL = config.backendUrl || 'ws://localhost:3001/chat'; 
  // Por ahora, ChatService podría instanciarse con la URL del backend si es necesario.
  const chatService = useRef(new ChatService(/* podrías pasar BACKEND_URL aquí */));
  const { toast } = useToast();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Efecto para inicializar el servicio de chat (que ahora se conectará al backend)
  useEffect(() => {
    // Solo intentar inicializar si la API key de OpenAI está presente (el backend la necesitará)
    if (config.openaiApiKey) {
      initializeAndConnectBackend();
    } else {
      setIsBackendConnected(false);
      // Opcional: toast para indicar que se necesita API key para que el backend funcione.
    }

    // Cleanup al desmontar o si config cambia
    return () => {
      chatService.current.disconnect(); // Suponiendo que disconnect cierra la conexión al backend
      setIsBackendConnected(false);
    };
  }, [config.openaiApiKey]); // Depender solo de openaiApiKey para la inicialización inicial

  const initializeAndConnectBackend = async () => {
    setIsLoading(true);
    try {
      // El método initialize de ChatService ahora podría tomar la config relevante 
      // para el backend (ej. URL del backend si no es fija, y la config de OpenAI para el backend)
      await chatService.current.initialize({ 
        openaiApiKey: config.openaiApiKey, 
        model: config.model 
        // Pasar otros parámetros si el ChatService los necesita para comunicarse con el backend
      });
      setIsBackendConnected(true);
      toast({
        title: "Conectado al Backend",
        description: "Listo para chatear.",
      });
    } catch (error) {
      console.error('Error connecting to backend:', error);
      setIsBackendConnected(false);
      toast({
        title: "Error de conexión al Backend",
        description: "No se pudo conectar al servidor backend. Verifica la consola.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !isBackendConnected) {
      if (!isBackendConnected) {
        toast({
          title: "Desconectado",
          description: "No se puede enviar mensaje. Verifica la conexión al backend y la configuración.",
          variant: "destructive",
        });
      }
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      role: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputMessage;
    setInputMessage('');
    setIsLoading(true);

    try {
      // sendMessage ahora solo envía el mensaje y el historial. El backend maneja las herramientas.
      const response = await chatService.current.sendMessage(currentInput, messages);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response.content, // Asumiendo que response tiene `content`
        role: 'assistant',
        timestamp: new Date(),
        // searchResults y tools podrían ya no ser relevantes desde el frontend si el backend los maneja
        tools: response.tools // Si el backend aún provee esta info para visualización
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message via backend:', error);
      toast({
        title: "Error al enviar mensaje",
        // @ts-ignore
        description: error.message || "No se pudo comunicar con el backend.",
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
    localStorage.setItem('openai_model', newConfig.model);
    // localStorage.setItem('backend_url', newConfig.backendUrl); // Si se hace configurable
    setShowConfig(false);
    // Re-inicializar la conexión al backend con la nueva configuración
    // El useEffect que depende de config.openaiApiKey se encargará de esto.
  };
  
  // Ya no se necesitan getActiveFeatureBadges ya que el backend maneja las herramientas.

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8 animate-scale-in">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl shadow-lg">
              <MessageCircle className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent">
                Chat Inteligente Pro
              </h1>
              <p className="text-gray-600 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Conectado a Backend para herramientas avanzadas
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Badge 
              variant={isBackendConnected ? "default" : "destructive"}
              className={`shadow-md ${isBackendConnected ? 
                "bg-gradient-to-r from-green-500 to-emerald-500" : 
                "bg-gradient-to-r from-red-500 to-rose-500"}`}
            >
              {isBackendConnected ? <Wifi className="w-4 h-4 mr-1"/> : <WifiOff className="w-4 h-4 mr-1"/>}
              {isBackendConnected ? "Backend Conectado" : "Backend Desconectado"}
            </Badge>
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
          {showConfig && (
            <div className="lg:col-span-1 animate-slide-in-right">
              <ConfigPanel
                config={config}
                onSave={handleConfigSave}
                onClose={() => setShowConfig(false)}
              />
            </div>
          )}

          <div className={`${showConfig ? 'lg:col-span-3' : 'lg:col-span-4'} animate-scale-in`}>
            <Card className="h-[650px] flex flex-col shadow-2xl bg-white/80 backdrop-blur-sm border-0">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-xl">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3">
                    {/* Icono puede cambiar si ya no es específico de MCP */} 
                    <MessageCircle className="w-6 h-6" /> 
                    Chat con Backend
                  </CardTitle>
                  <div className="text-sm opacity-90">
                    {messages.length} mensajes
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col p-0">
                <ScrollArea className="flex-1 p-6">
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-500 mt-12 animate-fade-in">
                       <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
                        <MessageCircle className="w-10 h-10 text-blue-500" />
                      </div>
                      <p className="text-xl font-medium text-gray-700 mb-2">
                        ¡Bienvenido al Chat Inteligente Pro!
                      </p>
                      <p className="text-sm text-gray-500 mb-4">
                        El chat ahora se conecta a un backend para capacidades mejoradas.
                      </p>
                      {!isBackendConnected && (
                        <p className="text-red-500 text-sm mt-4 p-3 bg-red-50 rounded-lg mx-auto max-w-md">
                          {config.openaiApiKey ? 
                            "Intentando conectar al backend..." : 
                            "Configura tu OpenAI API key para habilitar el chat."}
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
                              <span className="text-gray-600">Procesando en el backend...</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </ScrollArea>

                <Separator className="bg-gradient-to-r from-blue-200 to-purple-200" />

                <div className="p-6 bg-gradient-to-r from-gray-50 to-slate-50">
                  <div className="flex gap-3">
                    <Input
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder={
                        isBackendConnected 
                          ? "Escribe tu mensaje..." 
                          : (config.openaiApiKey ? "Conectando al backend..." : "Configura tu OpenAI API key primero...")
                      }
                      disabled={!isBackendConnected || isLoading || !config.openaiApiKey}
                      className="flex-1 border-gray-200 focus:border-blue-400 transition-all duration-200 shadow-sm"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!inputMessage.trim() || isLoading || !isBackendConnected || !config.openaiApiKey}
                      size="sm"
                      className="px-6 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg transition-all duration-200"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="text-xs text-gray-500 mt-3 flex items-center justify-between">
                    <span>Presiona Enter para enviar • Shift+Enter para nueva línea</span>
                     {/* Indicadores de herramientas específicas ya no son necesarios aquí */}
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
