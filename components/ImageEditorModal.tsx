import React, { useState } from 'react';
import { X, Wand2, Loader2, Save } from 'lucide-react';
import { editGeneratedImage, fileToGenerativePart } from '../services/routeraiService.ts';

interface Props {
  imageUrl: string;
  onClose: () => void;
  onSave: (newUrl: string) => void;
}

export const ImageEditorModal: React.FC<Props> = ({ imageUrl, onClose, onSave }) => {
  const [prompt, setPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [currentImage, setCurrentImage] = useState(imageUrl);

  const handleEdit = async () => {
    if (!prompt.trim()) return;
    setIsEditing(true);
    try {
      const response = await fetch(currentImage);
      const blob = await response.blob();
      const imagePart = await fileToGenerativePart(blob);
      
      const newImageUrl = await editGeneratedImage(imagePart, prompt);
      setCurrentImage(newImageUrl);
      setPrompt('');
    } catch (e) {
      console.error(e);
      alert('Ошибка при редактировании');
    } finally {
      setIsEditing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-architect-800 rounded-xl overflow-hidden max-w-4xl w-full flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b border-architect-200 dark:border-architect-700">
          <h3 className="font-semibold text-lg flex items-center gap-2 text-architect-900 dark:text-architect-100">
            <Wand2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            Редактор (RouterAI)
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-architect-100 dark:hover:bg-architect-700 rounded-full text-architect-600 dark:text-architect-300">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-architect-100 dark:bg-architect-900 flex items-center justify-center p-4">
          <img 
            src={currentImage} 
            alt="Editing" 
            className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg border border-white dark:border-architect-700"
          />
        </div>

        <div className="p-4 border-t border-architect-200 dark:border-architect-700 bg-white dark:bg-architect-800">
          <div className="flex gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Что изменить?"
              className="flex-1 px-4 py-2 border border-architect-300 dark:border-architect-600 bg-white dark:bg-architect-900 text-architect-900 dark:text-architect-100 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleEdit()}
            />
            <button
              onClick={handleEdit}
              disabled={isEditing || !prompt}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
            >
              {isEditing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
              Исправить
            </button>
            <button
              onClick={() => {
                onSave(currentImage);
                onClose();
              }}
              className="bg-architect-800 text-white px-6 py-2 rounded-lg hover:bg-architect-900 dark:bg-architect-700 dark:hover:bg-architect-600 flex items-center gap-2 font-medium"
            >
              <Save className="w-5 h-5" />
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};