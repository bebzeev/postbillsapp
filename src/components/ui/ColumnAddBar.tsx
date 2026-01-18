import { useRef } from 'react';
import { PlusIcon } from '../../icons';

interface ColumnAddBarProps {
  dayKey: string;
  onFiles: (dayKey: string, files: FileList) => void;
}

export function ColumnAddBar({ dayKey, onFiles }: ColumnAddBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="shrink-0 relative">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={async (e) => {
          if (e.target.files?.length) {
            await onFiles(dayKey, e.target.files);
            e.target.value = '';
          }
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="w-full h-[52px] rounded-[5px] border border-white flex items-center justify-center hover:bg-white/10 transition-colors"
        title="add images"
        aria-label="add images"
      >
        <PlusIcon />
      </button>
    </div>
  );
}
