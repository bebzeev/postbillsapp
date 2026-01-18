import React from 'react';

interface PlaceholderProps {
  onDropBlock: (e: React.DragEvent) => void;
  onDragOverBlock: (e: React.DragEvent) => void;
}

export const Placeholder = ({ onDropBlock, onDragOverBlock }: PlaceholderProps) => (
  <div
    className="relative z-20 h-10 rounded-[5px] border-2 border-dashed border-white/60 bg-white/10"
    aria-label="Drop position"
    onDragOver={onDragOverBlock}
    onDrop={onDropBlock}
    onDragEnter={onDragOverBlock}
  />
);
