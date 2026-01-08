import React, { useRef } from 'react';
import { Upload, FileImage } from 'lucide-react';

interface Props {
  onFileSelect: (file: File) => void;
}

export const PlanUploader: React.FC<Props> = ({ onFileSelect }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div 
      className="w-full max-w-2xl mx-auto border-2 border-dashed border-architect-300 dark:border-architect-600 rounded-xl bg-white dark:bg-architect-800 p-12 text-center hover:border-architect-500 dark:hover:border-architect-400 transition-colors cursor-pointer shadow-sm"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => inputRef.current?.click()}
    >
      <input 
        type="file" 
        ref={inputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleChange}
      />
      <div className="flex flex-col items-center gap-4">
        <div className="bg-architect-100 dark:bg-architect-700 p-4 rounded-full">
          <Upload className="w-8 h-8 text-architect-600 dark:text-architect-200" />
        </div>
        <h3 className="text-xl font-semibold text-architect-800 dark:text-architect-100">
          Загрузите план помещения
        </h3>
        <p className="text-architect-500 dark:text-architect-400 max-w-md">
          Перетащите изображение сюда или нажмите для выбора. Поддерживаются JPG, PNG (чертежи, планы БТИ, эскизы).
        </p>
      </div>
    </div>
  );
};