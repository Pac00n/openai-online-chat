
import React, { useState } from 'react';
import { Save, X, Key, Server, Bot, Clock, Search, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface Config {
  openaiApiKey: string;
  mcpServerUrl: string;
  model: string;
  enableTimeServer: boolean;
  enableWebSearch: boolean;
  webSearchProvider: 'pskill9' | 'brave' | 'docker';
  braveApiKey: string;
}

interface ConfigPanelProps {
  config: Config;
  onSave: (config: Config) => void;
  onClose: () => void;
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({ config, onSave, onClose }) => {
  const [localConfig, setLocalConfig] = useState<Config>(config);
  const [isValid, setIsValid] = useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    const valid = localConfig.openaiApiKey.trim() !== '' && 
      (!localConfig.enableWebSearch || 
       localConfig.webSearchProvider !== 'brave' || 
       localConfig.braveApiKey.trim() !== '');
    setIsValid(valid);
  }, [localConfig]);

  const handleSave = () => {
    if (!isValid) {
      toast({
        title: "Configuración incompleta",
        description: "Por favor completa todos los campos requeridos",
        variant: "destructive",
      });
      return;
    }

    onSave(localConfig);
    toast({
      title: "Configuración guardada",
      description: "Los cambios se han aplicado correctamente",
    });
  };

  const handleInputChange = (field: keyof Config, value: string | boolean) => {
    setLocalConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Card className="shadow-xl bg-gradient-to-br from-white to-gray-50 border-0">
      <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Key className="w-5 h-5" />
            Configuración
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-white hover:bg-white/20">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* OpenAI API Key */}
        <div className="space-y-2">
          <Label htmlFor="apikey" className="text-sm font-medium flex items-center gap-2">
            <Bot className="w-4 h-4 text-green-600" />
            OpenAI API Key *
          </Label>
          <Input
            id="apikey"
            type="password"
            value={localConfig.openaiApiKey}
            onChange={(e) => handleInputChange('openaiApiKey', e.target.value)}
            placeholder="sk-..."
            className="text-sm border-gray-200 focus:border-blue-400 transition-colors"
          />
          <p className="text-xs text-gray-500">
            Tu clave API de OpenAI para acceder a los modelos
          </p>
        </div>

        {/* Time MCP Server Toggle */}
        <div className="space-y-3 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              Servidor MCP Time
            </Label>
            <Button
              variant={localConfig.enableTimeServer ? "default" : "outline"}
              size="sm"
              onClick={() => handleInputChange('enableTimeServer', !localConfig.enableTimeServer)}
              className={localConfig.enableTimeServer ? 
                "bg-gradient-to-r from-amber-500 to-orange-500 text-white" : 
                "border-amber-300 text-amber-700 hover:bg-amber-50"
              }
            >
              {localConfig.enableTimeServer ? 'Activado' : 'Desactivado'}
            </Button>
          </div>
          <p className="text-xs text-amber-700">
            Habilita herramientas para obtener hora actual y diferencias horarias
          </p>
        </div>

        {/* Web Search MCP Servers */}
        <div className="space-y-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Search className="w-4 h-4 text-blue-600" />
              Búsqueda Web MCP
            </Label>
            <Button
              variant={localConfig.enableWebSearch ? "default" : "outline"}
              size="sm"
              onClick={() => handleInputChange('enableWebSearch', !localConfig.enableWebSearch)}
              className={localConfig.enableWebSearch ? 
                "bg-gradient-to-r from-blue-500 to-indigo-500 text-white" : 
                "border-blue-300 text-blue-700 hover:bg-blue-50"
              }
            >
              {localConfig.enableWebSearch ? 'Activado' : 'Desactivado'}
            </Button>
          </div>
          <p className="text-xs text-blue-700">
            Habilita búsquedas web en tiempo real con servidores MCP
          </p>

          {localConfig.enableWebSearch && (
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Proveedor de Búsqueda</Label>
                <Select
                  value={localConfig.webSearchProvider}
                  onValueChange={(value) => handleInputChange('webSearchProvider', value as 'pskill9' | 'brave' | 'docker')}
                >
                  <SelectTrigger className="border-blue-200 focus:border-blue-400 transition-colors">
                    <SelectValue placeholder="Selecciona un proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pskill9">pskill9/web-search (Sin credenciales)</SelectItem>
                    <SelectItem value="brave">Brave Search API (Con API key)</SelectItem>
                    <SelectItem value="docker">Docker Search Server (Sin credenciales)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {localConfig.webSearchProvider === 'brave' && (
                <div className="space-y-2">
                  <Label htmlFor="bravekey" className="text-sm font-medium flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-600" />
                    Brave Search API Key *
                  </Label>
                  <Input
                    id="bravekey"
                    type="password"
                    value={localConfig.braveApiKey}
                    onChange={(e) => handleInputChange('braveApiKey', e.target.value)}
                    placeholder="BSA..."
                    className="text-sm border-blue-200 focus:border-blue-400 transition-colors"
                  />
                  <p className="text-xs text-blue-600">
                    Tu API key de Brave Search (2,000 búsquedas/mes gratis)
                  </p>
                </div>
              )}

              <div className="mt-2 p-2 bg-white/50 rounded text-xs text-blue-800">
                <div className="font-medium mb-1">Herramientas disponibles:</div>
                {localConfig.webSearchProvider === 'pskill9' && (
                  <span>• search(query, limit) - Raspado de Google</span>
                )}
                {localConfig.webSearchProvider === 'brave' && (
                  <div>
                    <span>• brave_web_search(query, count, offset)</span><br/>
                    <span>• brave_local_search(query, count)</span>
                  </div>
                )}
                {localConfig.webSearchProvider === 'docker' && (
                  <span>• google_search - Con caché y opciones avanzadas</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* MCP Server URL */}
        <div className="space-y-2">
          <Label htmlFor="mcpurl" className="text-sm font-medium flex items-center gap-2">
            <Server className="w-4 h-4 text-blue-600" />
            Servidor MCP Adicional (Opcional)
          </Label>
          <Input
            id="mcpurl"
            type="text"
            value={localConfig.mcpServerUrl}
            onChange={(e) => handleInputChange('mcpServerUrl', e.target.value)}
            placeholder="ws://localhost:3001"
            className="text-sm border-gray-200 focus:border-blue-400 transition-colors"
          />
          <p className="text-xs text-gray-500">
            URL adicional para otros servidores MCP
          </p>
        </div>

        {/* Model Selection */}
        <div className="space-y-2">
          <Label htmlFor="model" className="text-sm font-medium">
            Modelo de OpenAI
          </Label>
          <Select
            value={localConfig.model}
            onValueChange={(value) => handleInputChange('model', value)}
          >
            <SelectTrigger className="border-gray-200 focus:border-blue-400 transition-colors">
              <SelectValue placeholder="Selecciona un modelo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-4o-mini">GPT-4o Mini (Rápido y económico)</SelectItem>
              <SelectItem value="gpt-4o">GPT-4o (Más potente)</SelectItem>
              <SelectItem value="gpt-4.5-preview">GPT-4.5 Preview (Experimental)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Connection Status */}
        <div className={`p-4 rounded-lg border ${isValid ? 
          'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' : 
          'bg-gradient-to-r from-red-50 to-rose-50 border-red-200'
        }`}>
          <div className="text-sm">
            <div className={`font-medium mb-1 ${isValid ? 'text-green-900' : 'text-red-900'}`}>
              Estado de la conexión
            </div>
            <div className={`text-xs ${isValid ? 'text-green-700' : 'text-red-700'}`}>
              {isValid ? (
                "✅ Configuración válida - Listo para conectar"
              ) : (
                "⚠️ Completa los campos requeridos (*)"
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <Button
            onClick={handleSave}
            disabled={!isValid}
            className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg transition-all duration-200"
            size="sm"
          >
            <Save className="w-4 h-4 mr-2" />
            Guardar
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            size="sm"
            className="border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </Button>
        </div>

        {/* Help Text */}
        <div className="text-xs text-gray-500 bg-gradient-to-r from-gray-50 to-slate-50 p-4 rounded-lg border border-gray-100">
          <div className="font-medium mb-2 text-gray-700">Ayuda rápida:</div>
          <ul className="space-y-1">
            <li>• Obtén tu OpenAI API key en: platform.openai.com</li>
            <li>• Brave Search API key gratuita en: brave.com/search/api</li>
            <li>• pskill9/web-search: sin credenciales, perfecto para pruebas</li>
            <li>• Docker search: más robusto con caché automático</li>
            <li>• Los datos se guardan localmente en tu navegador</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default ConfigPanel;
