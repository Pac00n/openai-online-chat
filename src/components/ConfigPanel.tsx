
import React, { useState } from 'react';
import { Save, X, Key, Server, Bot } from 'lucide-react';
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
    const valid = localConfig.openaiApiKey.trim() !== '' && localConfig.mcpServerUrl.trim() !== '';
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

  const handleInputChange = (field: keyof Config, value: string) => {
    setLocalConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="bg-gray-50 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Key className="w-5 h-5 text-blue-600" />
            Configuración
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
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
            className="text-sm"
          />
          <p className="text-xs text-gray-500">
            Tu clave API de OpenAI para acceder a los modelos
          </p>
        </div>

        {/* MCP Server URL */}
        <div className="space-y-2">
          <Label htmlFor="mcpurl" className="text-sm font-medium flex items-center gap-2">
            <Server className="w-4 h-4 text-blue-600" />
            Servidor MCP *
          </Label>
          <Input
            id="mcpurl"
            type="text"
            value={localConfig.mcpServerUrl}
            onChange={(e) => handleInputChange('mcpServerUrl', e.target.value)}
            placeholder="ws://localhost:3001"
            className="text-sm"
          />
          <p className="text-xs text-gray-500">
            URL del servidor MCP para búsquedas online
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
            <SelectTrigger>
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
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-sm">
            <div className="font-medium text-blue-900 mb-1">Estado de la conexión</div>
            <div className="text-blue-700 text-xs">
              {isValid ? (
                "✅ Configuración válida - Listo para conectar"
              ) : (
                "⚠️ Completa los campos requeridos (*)"
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleSave}
            disabled={!isValid}
            className="flex-1"
            size="sm"
          >
            <Save className="w-4 h-4 mr-2" />
            Guardar
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            size="sm"
          >
            Cancelar
          </Button>
        </div>

        {/* Help Text */}
        <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
          <div className="font-medium mb-1">Ayuda:</div>
          <ul className="space-y-1">
            <li>• Obtén tu API key en: platform.openai.com</li>
            <li>• El servidor MCP debe estar ejecutándose localmente</li>
            <li>• Los datos se guardan en tu navegador</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default ConfigPanel;
