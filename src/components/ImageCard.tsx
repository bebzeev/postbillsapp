import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Star, Trash2, Copy, Link2 } from 'lucide-react';
import type { ImageItem } from '../types';

interface ImageCardProps {
  item: ImageItem;
  dayKey: string;
  index: number;
  isDragging: boolean;
  isTouch: boolean;
  onView: () => void;
  onDelete: () => void;
  onToggleFav: () => void;
  onCopyImage: (e: React.MouseEvent) => void;
  onCopyLink: (e: React.MouseEvent) => void;
}

export function ImageCard({
  item,
  dayKey,
  index,
  isDragging,
  isTouch,
  onView,
  onDelete,
  onToggleFav,
  onCopyImage,
  onCopyLink,
}: ImageCardProps) {
  return (
    <Draggable draggableId={item.id} index={index}>
      {(provided, snap) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          data-item-id={item.id}
          className={`group relative select-none shrink-0 ${
            snap.isDragging ? 'rotate-1' : ''
          }`}
          style={{
            ...provided.draggableProps.style,
            touchAction: isDragging ? 'none' : 'auto',
          }}
        >
          {/* Event Card */}
          <div
            className="relative w-full bg-white rounded-[5px] overflow-hidden cursor-pointer"
            style={{ boxShadow: '0px 4px 4px 0px rgba(0,0,0,0.25)' }}
            onClick={onView}
          >
            <img
              src={item.dataUrl}
              alt={item.name || 'flyer'}
              className="w-full h-auto object-cover"
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              style={{
                WebkitUserDrag: 'none',
                userSelect: 'none',
                WebkitTouchCallout: 'none',
              } as React.CSSProperties}
            />
            {/* Inner shadow on card */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                boxShadow: 'inset 1px 2px 2.8px 0px rgba(255,255,255,0.34)',
              }}
            />
          </div>

          {/* Delete button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className={`absolute top-2 left-2 w-7 h-7 rounded-full bg-red-600 text-white shadow-md grid place-items-center transition-opacity ${
              isTouch
                ? 'opacity-0 pointer-events-none'
                : 'opacity-0 group-hover:opacity-100'
            }`}
            title="delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Action buttons */}
          <div className="absolute top-2 right-2 flex flex-col gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFav();
              }}
              className={`w-7 h-7 rounded-full grid place-items-center transition-opacity shadow-md ${
                item.fav ? 'bg-[#0037ae]' : 'bg-white/90'
              } ${
                item.fav
                  ? ''
                  : isTouch
                  ? 'opacity-0 pointer-events-none'
                  : 'opacity-0 group-hover:opacity-100'
              }`}
              title={item.fav ? 'unfavorite' : 'favorite'}
            >
              <Star
                className="w-3.5 h-3.5"
                {...(item.fav
                  ? { color: 'white', fill: 'white' }
                  : { color: '#0037ae' })}
              />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onCopyImage(e);
              }}
              className={`w-7 h-7 rounded-full bg-white/90 shadow-md grid place-items-center transition-opacity ${
                isTouch
                  ? 'opacity-0 pointer-events-none'
                  : 'opacity-0 group-hover:opacity-100'
              }`}
              title="download image"
            >
              <Copy className="w-3.5 h-3.5 text-[#0037ae]" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onCopyLink(e);
              }}
              className={`w-7 h-7 rounded-full bg-white/90 shadow-md grid place-items-center transition-opacity ${
                isTouch
                  ? 'opacity-0 pointer-events-none'
                  : 'opacity-0 group-hover:opacity-100'
              }`}
              title="copy link to image"
            >
              <Link2 className="w-3.5 h-3.5 text-[#0037ae]" />
            </button>
          </div>
        </div>
      )}
    </Draggable>
  );
}
