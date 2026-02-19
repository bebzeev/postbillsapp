import React, { useState, useRef, useEffect } from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { DESIGN } from '../constants/design';
import { fmtDOWShort, fmtMD } from '../utils/date';
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
  expandLevel?: number; // 0 = normal, 1 = 2 columns, 2 = 3 columns
  onSetExpandLevel?: (dayKey: string, level: number) => void;
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
  expandLevel = 0,
  onSetExpandLevel,
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
  const isExpanded = expandLevel > 0;

  // Long-press state
  const longPressTimer1 = useRef<NodeJS.Timeout | null>(null);
  const longPressTimer2 = useRef<NodeJS.Timeout | null>(null);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const currentLevelRef = useRef(expandLevel);
  currentLevelRef.current = expandLevel;

  const triggerHaptic = () => {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(15);
      } catch {}
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isTouch || !onSetExpandLevel) return;

    setIsLongPressing(true);

    // 1 second: expand to level 1 (2 columns) or collapse if already expanded
    longPressTimer1.current = setTimeout(() => {
      const current = currentLevelRef.current;
      if (current === 0) {
        // Expand to level 1
        triggerHaptic();
        onSetExpandLevel(dayKey, 1);
      } else {
        // Collapse back to normal
        triggerHaptic();
        onSetExpandLevel(dayKey, 0);
        setIsLongPressing(false);
      }
    }, 1000);

    // 2 seconds: expand to level 2 (3 columns) - only if starting from 0
    longPressTimer2.current = setTimeout(() => {
      const current = currentLevelRef.current;
      if (current === 1) {
        // Expand to level 2
        triggerHaptic();
        onSetExpandLevel(dayKey, 2);
      }
      setIsLongPressing(false);
    }, 2000);
  };

  const handleTouchEnd = () => {
    if (longPressTimer1.current) {
      clearTimeout(longPressTimer1.current);
      longPressTimer1.current = null;
    }
    if (longPressTimer2.current) {
      clearTimeout(longPressTimer2.current);
      longPressTimer2.current = null;
    }
    setIsLongPressing(false);
  };

  useEffect(() => {
    return () => {
      if (longPressTimer1.current) {
        clearTimeout(longPressTimer1.current);
      }
      if (longPressTimer2.current) {
        clearTimeout(longPressTimer2.current);
      }
    };
  }, []);

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
            minWidth: expandLevel === 2 ? '100vw' : expandLevel === 1 ? width * 2 + 8 : width,
            width: expandLevel === 2 ? '100vw' : expandLevel === 1 ? width * 2 + 8 : width,
            touchAction: isDragging ? 'none' : 'auto',
            overscrollBehaviorY: 'none',
            transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1), min-width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          onTouchMove={(e) => {
            if (isDragging) e.preventDefault();
          }}
          className={`relative h-full flex flex-col rounded-t-[10px] border border-white p-[6px] gap-[10px] ${
            fileOver === dayKey
              ? 'border-2 border-dashed border-white/80'
              : ''
          } ${isExpanded ? 'z-30' : ''}`}
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
          <div
            className="relative z-10 shrink-0 w-full select-none"
            style={{
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none',
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
            {isToday ? (
              // White filled header ONLY for today
              <div
                className={`w-full rounded-[5px] bg-white flex flex-col items-center gap-px p-[6px] transition-opacity ${
                  isLongPressing ? 'opacity-70' : ''
                }`}
                style={{ color: DESIGN.colors.mainBlue }}
              >
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
            ) : (
              // Border-only header for all other columns
              <div
                className={`w-full rounded-[5px] border border-white flex flex-col items-center gap-px p-[5px] text-white transition-opacity ${
                  isLongPressing ? 'opacity-70' : ''
                }`}
              >
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

          {/* Images area wrapper */}
          <div className="relative flex-1 overflow-hidden">
            {/* Past day overlay - positioned over the entire images area */}
            {isPast && (
              <div className="pointer-events-none absolute inset-0 rounded-[5px] bg-[#0037ae]/60 z-10" />
            )}
            {/* Scrollable images container */}
            <div
              ref={listRef}
              className={`h-full overflow-y-auto overflow-x-hidden ${
                isExpanded
                  ? ''
                  : 'flex flex-col gap-[10px]'
              }`}
              style={{
                touchAction: isDragging ? 'none' : 'auto',
                ...(isExpanded ? {
                  columnCount: expandLevel === 2 ? 3 : 2,
                  columnGap: '10px',
                } : {}),
              }}
              onDragEnter={(e) => onExtOver(e, dayKey)}
              onDragOver={(e) => onExtOver(e, dayKey)}
              onDrop={(e) => {
                if (e.dataTransfer?.files?.length) {
                  e.preventDefault();
                  e.stopPropagation();
                  onExtDrop(e, dayKey);
                }
              }}
              onTouchMove={(e) => {
                if (isDragging) e.preventDefault();
              }}
            >
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
                <div
                  style={{
                    breakInside: 'avoid',
                    marginBottom: isExpanded ? '10px' : '0',
                  }}
                >
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
                </div>
              </React.Fragment>
            ))}
            {provided.placeholder}
            </div>
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
