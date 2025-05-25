
import React, { useState, useEffect } from 'react';
import { Save, X, Key, Bot } from 'lucide-react'; // Iconos reducidos
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

// Interfaz de configuración simplificada
interface Config {
  openaiApiKey: string;
  model: string;
  // Eliminamos: mcpServerUrl, enableTimeServer, enableWebSearch, webSearchProvider, braveApiKey
  // La URL del backend para el chat podría ir aquí si es configurable, o ser una constante.
  // Por ahora, asumimos que ChatService sabrá dónde está el backend.
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

  useEffect(() => {
    // Validación simplificada: solo se requiere la API key de OpenAI
    const valid = localConfig.openaiApiKey.trim() !== '';
    setIsValid(valid);
  }, [localConfig]);

  const handleSave = () => {
    if (!isValid) {
      toast({
        title: "Configuración incompleta",
        description: "Por favor, ingresa tu OpenAI API Key.",
        variant: "destructive",
      });
      return;
    }
    onSave(localConfig);
    toast({
      title: "Configuración guardada",
      description: "Los cambios se han aplicado correctamente.",
    });
  };

  const handleInputChange = (field: keyof Config, value: string) => {
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
            Tu clave API de OpenAI para acceder a los modelos.
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
              {/* Mantener otros modelos si son relevantes */}
              <SelectItem value="gpt-4.5-preview">GPT-4.5 Preview (Experimental)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Ya no se necesitan las secciones de Time MCP, Web Search MCP, MCP Server URL */}

        {/* Connection Status (simplificado) */}
        <div className={`p-4 rounded-lg border ${isValid ? 
          'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' : 
          'bg-gradient-to-r from-red-50 to-rose-50 border-red-200'
        }`}>
          <div className="text-sm">
            <div className={`font-medium mb-1 ${isValid ? 'text-green-900' : 'text-red-900'}`}>
              Estado de la Configuración
            </div>
            <div className={`text-xs ${isValid ? 'text-green-700' : 'text-red-700'}`}>
              {isValid ? (
                "✅ Configuración válida."
              ) : (
                "⚠️ OpenAI API Key es requerida."
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

        {/* Help Text (simplificado) */}
        <div className="text-xs text-gray-500 bg-gradient-to-r from-gray-50 to-slate-50 p-4 rounded-lg border border-gray-100">
          <div className="font-medium mb-2 text-gray-700">Ayuda rápida:</div>
          <ul className="space-y-1">
            <li>• Obtén tu OpenAI API key en: platform.openai.com</li>
            <li>• La configuración se guarda localmente en tu navegador.</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default ConfigPanel;
