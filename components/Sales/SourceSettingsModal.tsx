import React, { useState } from 'react';
import { X } from 'lucide-react';

interface SourceSettingsModalProps {
  isOpen: boolean;
  sourceName: string | null;
  onClose: () => void;
  onSave?: (settings: any) => void;
}

export const SourceSettingsModal: React.FC<SourceSettingsModalProps> = ({ 
  isOpen, 
  sourceName,
  onClose, 
  onSave 
}) => {
  const [settings, setSettings] = useState({
    name: sourceName || '',
    apiKey: '',
    apiSecret: '',
    webhookUrl: '',
    isActive: true,
  });

  if (!isOpen || !sourceName) return null;

  const sourceIcons: Record<string, string> = {
    'Сайт': '🌐',
    'Авито': '🏠',
    'ВКонтакте': '🔵',
    'Телеграм': '✈️',
    'Телефония': '☎️',
    'Email': '📧',
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-architect-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-architect-200 dark:border-architect-700">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{sourceIcons[sourceName] || '📌'}</span>
            <h2 className="text-xl font-semibold text-architect-900 dark:text-architect-100">
              Настройка {sourceName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-architect-100 dark:hover:bg-architect-700 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
                Название
              </label>
              <input
                type="text"
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-architect-900 border border-architect-200 dark:border-architect-700 rounded-lg text-architect-900 dark:text-architect-100 focus:outline-none focus:border-architect-500"
              />
            </div>

            {sourceName === 'Сайт' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
                    Webhook URL
                  </label>
                  <input
                    type="text"
                    value={settings.webhookUrl}
                    onChange={(e) => setSettings({ ...settings, webhookUrl: e.target.value })}
                    placeholder="https://example.com/webhook"
                    className="w-full px-3 py-2 bg-white dark:bg-architect-900 border border-architect-200 dark:border-architect-700 rounded-lg text-architect-900 dark:text-architect-100 focus:outline-none focus:border-architect-500"
                  />
                </div>
              </>
            )}

            {sourceName === 'Телеграм' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
                    API Token
                  </label>
                  <input
                    type="text"
                    value={settings.apiKey}
                    onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                    placeholder="Введите токен бота"
                    className="w-full px-3 py-2 bg-white dark:bg-architect-900 border border-architect-200 dark:border-architect-700 rounded-lg text-architect-900 dark:text-architect-100 focus:outline-none focus:border-architect-500"
                  />
                </div>
              </>
            )}

            {sourceName === 'ВКонтакте' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
                    Access Token
                  </label>
                  <input
                    type="text"
                    value={settings.apiKey}
                    onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                    placeholder="Введите access token"
                    className="w-full px-3 py-2 bg-white dark:bg-architect-900 border border-architect-200 dark:border-architect-700 rounded-lg text-architect-900 dark:text-architect-100 focus:outline-none focus:border-architect-500"
                  />
                </div>
              </>
            )}

            <div className="flex items-center justify-between pt-2">
              <label className="text-sm font-medium text-architect-700 dark:text-architect-300">
                Активен
              </label>
              <button
                onClick={() => setSettings({ ...settings, isActive: !settings.isActive })}
                className={`relative inline-block w-10 h-5 rounded-full transition-colors ${
                  settings.isActive ? 'bg-blue-500' : 'bg-architect-300 dark:bg-architect-600'
                }`}
              >
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${
                  settings.isActive ? 'right-1' : 'left-1'
                }`}></div>
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-architect-200 dark:border-architect-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-architect-200 dark:border-architect-700 rounded-lg hover:bg-architect-50 dark:hover:bg-architect-700 text-architect-700 dark:text-architect-300"
          >
            Отмена
          </button>
          <button
            onClick={() => {
              if (onSave) onSave(settings);
              onClose();
            }}
            className="px-4 py-2 text-sm bg-architect-900 dark:bg-white text-white dark:text-architect-900 rounded-lg hover:bg-architect-800 dark:hover:bg-architect-100 font-medium"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};
