import React from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { DESIGN } from '../constants/design';
import { fmtDOW, fmtDOWShort, fmtMD } from '../utils/date';
import { ImageCard } from './ImageCard';
import { ColumnAddBar, Placeholder } from './ui';
import type { ImageItem, ExternalHover } from '../types';

interface DayColumnProps {
  date: Date;
  dayKey: string;
  items: ImageItem[];
  width: number;
  isToday: boolean;
  isPast: boolean;
  isDragging: boolean;
  isTouch: boolean;
  fileOver: string | null;
  externalHover: ExternalHover;
  showFavOnly: boolean;
  onExtOver: (e: React.DragEvent, dayKey: string) => void;
  onExtLeave: (e: React.DragEvent, dayKey: string) => void;
  onExtDrop: (e: React.DragEvent, dayKey: string) => void;
  onFilesAdded: (dayKey: string, files: FileList) => void;
  onViewImage: (item: ImageItem, dayKey: string) => void;
  onDeleteImage: (dayKey: string, id: string) => void;
  onToggleFav: (dayKey: string, id: string, nextFav: boolean) => void;
  onCopyImage: (item: ImageItem, e: React.MouseEvent) => void;
  onCopyLink: (dayKey: string, id: string, e: React.MouseEvent) => void;
  columnRef?: (el: HTMLDivElement | null) => void;
  listRef?: (el: HTMLDivElement | null) => void;
}

export function DayColumn({
  date,
  dayKey,
  items,
  width,
  isToday,
  isPast,
  isDragging,
  isTouch,
  fileOver,
  externalHover,
  showFavOnly,
  onExtOver,
  onExtLeave,
  onExtDrop,
  onFilesAdded,
  onViewImage,
  onDeleteImage,
  onToggleFav,
  onCopyImage,
  onCopyLink,
  columnRef,
  listRef,
}: DayColumnProps) {
  const phIdx = externalHover.dayKey === dayKey ? externalHover.index : -1;
  const render = showFavOnly ? items.filter((x) => !!x.fav) : items;

  return (
    <Droppable droppableId={dayKey}>
      {(provided, snap) => (
        <div
          ref={(el) => {
            provided.innerRef(el);
            columnRef?.(el);
          }}
          {...provided.droppableProps}
          onDragOver={(e) => onExtOver(e, dayKey)}
          onDragLeave={(e) => onExtLeave(e, dayKey)}
          onDrop={(e) => onExtDrop(e, dayKey)}
          style={{
            minWidth: width,
            width: width,
            touchAction: isDragging ? 'none' : 'auto',
            overscrollBehaviorY: 'contain',
          }}
          onTouchMove={(e) => {
            if (isDragging) e.preventDefault();
          }}
          className={`relative h-full flex flex-col rounded-t-[10px] border border-white p-[6px] gap-[10px] transition-all duration-200 ease-out ${
            fileOver === dayKey
              ? 'border-2 border-dashed border-white/80'
              : ''
          }`}
          data-column-key={dayKey}
        >
          {/* Inner shadow overlay */}
          <div
            className="absolute inset-0 pointer-events-none rounded-t-[10px]"
            style={{
              boxShadow: 'inset 2px 2px 3.6px 0px rgba(255,255,255,0.24)',
            }}
          />

          {/* Header */}
          <div className="relative z-10 shrink-0 w-full">
            {isToday ? (
              // White filled header ONLY for today
              <div
                className="w-full rounded-[5px] bg-white flex flex-col items-center gap-px p-[5px]"
                style={{ color: DESIGN.colors.mainBlue }}
              >
                <div
                  className="uppercase tracking-[0.2488px] leading-[19.5px]"
                  style={{
                    fontFamily: "'Andale Mono', monospace",
                    fontSize: '18px',
                  }}
                >
                  {fmtDOW(date).toUpperCase()}
                </div>
                <div
                  className="uppercase tracking-[0.2488px] leading-[19.5px]"
                  style={{
                    fontFamily: DESIGN.fonts.body,
                    fontSize: '13px',
                    fontWeight: 500,
                  }}
                >
                  {fmtMD(date)}
                </div>
              </div>
            ) : (
              // Border-only header for all other columns
              <div className="w-full rounded-[5px] border border-white flex flex-col items-center gap-px p-[6px] text-white">
                <div
                  className="uppercase tracking-[0.2488px] leading-[19.5px]"
                  style={{
                    fontFamily: "'Andale Mono', monospace",
                    fontSize: '18px',
                  }}
                >
                  {fmtDOWShort(date)}
                </div>
                <div
                  className="uppercase tracking-[0.2488px] leading-[19.5px]"
                  style={{
                    fontFamily: DESIGN.fonts.body,
                    fontSize: '13px',
                    fontWeight: 500,
                  }}
                >
                  {fmtMD(date)}
                </div>
              </div>
            )}
          </div>

          {/* Images area */}
          <div
            ref={listRef}
            className="relative flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-[10px]"
            onDragEnter={(e) => onExtOver(e, dayKey)}
            onDragOver={(e) => onExtOver(e, dayKey)}
            onDrop={(e) => {
              if (e.dataTransfer?.files?.length) {
                e.preventDefault();
                e.stopPropagation();
                onExtDrop(e, dayKey);
              }
            }}
            style={{ touchAction: isDragging ? 'none' : 'auto' }}
            onTouchMove={(e) => {
              if (isDragging) e.preventDefault();
            }}
          >
            {isPast && (
              <div className="pointer-events-none absolute inset-0 rounded-[5px] bg-[#0037ae]/60 z-10" />
            )}
            {render.length > 0 && phIdx === 0 && (
              <Placeholder
                onDragOverBlock={(e) => {
                  if (e.dataTransfer?.types?.includes('Files')) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                onDropBlock={(e) => {
                  if (e.dataTransfer?.files?.length) {
                    e.preventDefault();
                    e.stopPropagation();
                    onExtDrop(e, dayKey);
                  }
                }}
              />
            )}
            {render.map((it, idx) => (
              <React.Fragment key={it.id}>
                {phIdx === idx && idx > 0 && idx < render.length && (
                  <Placeholder
                    onDragOverBlock={(e) => {
                      if (e.dataTransfer?.types?.includes('Files')) {
                        e.preventDefault();
                        e.stopPropagation();
                      }
                    }}
                    onDropBlock={(e) => {
                      if (e.dataTransfer?.files?.length) {
                        e.preventDefault();
                        e.stopPropagation();
                        onExtDrop(e, dayKey);
                      }
                    }}
                  />
                )}
                <ImageCard
                  item={it}
                  dayKey={dayKey}
                  index={idx}
                  isDragging={isDragging}
                  isTouch={isTouch}
                  onView={() => onViewImage(it, dayKey)}
                  onDelete={() => onDeleteImage(dayKey, it.id)}
                  onToggleFav={() => onToggleFav(dayKey, it.id, !it.fav)}
                  onCopyImage={(e) => onCopyImage(it, e)}
                  onCopyLink={(e) => onCopyLink(dayKey, it.id, e)}
                />
              </React.Fragment>
            ))}
            {provided.placeholder}
          </div>

          {/* Add button */}
          <div className="relative z-10 shrink-0">
            <ColumnAddBar dayKey={dayKey} onFiles={onFilesAdded} />
          </div>
        </div>
      )}
    </Droppable>
  );
}
