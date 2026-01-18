import React, { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { X, Trash2, Star, Copy, Download, FileText, ChevronUp } from 'lucide-react';
import type { Viewer } from '../../types';

interface ImageViewerProps {
  viewer: Viewer;
  showNotes: boolean;
  isTouch: boolean;
  onClose: () => void;
  onDelete: () => void;
  onToggleFav: () => void;
  onCopyImage: (e: React.MouseEvent) => void;
  onDownloadImage: (e: React.MouseEvent) => void;
  onToggleNotes: () => void;
  onUpdateNote: (note: string) => void;
}

// Inline type for drag info since PanInfo is not exported in framer-motion v12
interface DragInfo {
  offset: { x: number; y: number };
  velocity: { x: number; y: number };
}

export function ImageViewer({
  viewer,
  showNotes,
  isTouch,
  onClose,
  onDelete,
  onToggleFav,
  onCopyImage,
  onDownloadImage,
  onToggleNotes,
  onUpdateNote,
}: ImageViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragY = useMotionValue(0);
  
  // Transform for the swipe indicator opacity
  const indicatorOpacity = useTransform(dragY, [-50, 0], [0, 1]);
  
  const handleDragEnd = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: DragInfo) => {
    setIsDragging(false);
    // If swiped up more than 40px with velocity, show notes
    if (info.offset.y < -40 || info.velocity.y < -150) {
      if (!showNotes) {
        onToggleNotes();
      }
    }
    // If swiped down more than 30px with velocity, hide notes (easier to swipe down)
    if (info.offset.y > 30 || info.velocity.y > 150) {
      if (showNotes) {
        onToggleNotes();
      }
    }
  }, [showNotes, onToggleNotes]);

  // Handle clicks on the backdrop to close the modal
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    // Only close if clicking directly on the backdrop, not on children
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center"
      style={{
        zIndex: 9999,
        minHeight: '100vh',
        minHeight: '100dvh',
      }}
      onClick={handleBackdropClick}
    >
      <button
        onClick={onClose}
        className="fixed top-4 right-4 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 grid place-items-center transition-all"
        style={{ zIndex: 10000 }}
        title="close"
        aria-label="close"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      <motion.div
        ref={containerRef}
        className="relative max-w-4xl w-full flex items-center justify-center px-4"
        drag={isTouch ? "y" : false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        style={{ y: dragY }}
        onClick={handleBackdropClick}
      >
        {/* Swipe indicator */}
        {isTouch && !showNotes && (
          <motion.div 
            className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none"
            style={{ opacity: indicatorOpacity }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            transition={{ delay: 0.5 }}
          >
            <ChevronUp className="w-5 h-5 text-white animate-bounce" />
            <span className="text-xs text-white/70">swipe for notes</span>
          </motion.div>
        )}
        
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex justify-center group min-h-[200px]"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <img
            src={viewer.url}
            alt={viewer.name || 'flyer'}
            className="max-w-full max-h-[60vh] object-contain rounded-[10px] shadow-2xl"
            style={{
              touchAction: 'auto',
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }}
          />

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className={`absolute top-3 left-3 z-10 w-10 h-10 rounded-full bg-red-600 text-white shadow-lg grid place-items-center ${
              isTouch ? '' : 'opacity-0 group-hover:opacity-100'
            } transition-opacity`}
            title="delete"
            aria-label="delete"
          >
            <Trash2 className="w-5 h-5" />
          </button>

          <div
            className={`absolute top-3 right-3 z-10 flex flex-col gap-2 ${
              isTouch ? '' : 'opacity-0 group-hover:opacity-100'
            } transition-opacity`}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFav();
              }}
              className={`w-10 h-10 rounded-full grid place-items-center shadow-lg ${
                viewer.fav ? 'bg-[#0037ae]' : 'bg-white'
              }`}
              title={viewer.fav ? 'unfavorite' : 'favorite'}
              aria-label="favorite"
            >
              <Star
                className="w-5 h-5"
                {...(viewer.fav
                  ? { color: 'white', fill: 'white' }
                  : { color: '#0037ae' })}
              />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onCopyImage(e);
              }}
              className="w-10 h-10 rounded-full bg-white shadow-lg grid place-items-center"
              title="copy image"
              aria-label="copy image"
            >
              <Copy className="w-5 h-5 text-[#0037ae]" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownloadImage(e);
              }}
              className="w-10 h-10 rounded-full bg-white shadow-lg grid place-items-center"
              title="download image"
              aria-label="download image"
            >
              <Download className="w-5 h-5 text-[#0037ae]" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleNotes();
              }}
              className={`w-10 h-10 rounded-full grid place-items-center shadow-lg ${
                viewer.note ? 'bg-[#0037ae]' : 'bg-white'
              }`}
              title={viewer.note ? 'toggle notes' : 'add notes'}
              aria-label="toggle notes"
            >
              <FileText
                className="w-5 h-5"
                {...(viewer.note ? { color: 'white' } : { color: '#0037ae' })}
              />
            </button>
          </div>
        </motion.div>

        <AnimatePresence>
          {showNotes && (
            <motion.div
              key="notes-panel"
              initial={{ y: 60, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 60, opacity: 0, scale: 0.95 }}
              transition={{
                type: 'spring',
                stiffness: 400,
                damping: 30,
              }}
              className="absolute bottom-0 left-0 right-0 mx-auto w-[calc(100%-32px)] max-w-2xl p-3 rounded-lg bg-[#0037ae] shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-medium text-white">
                  Notes
                </label>
                {isTouch && (
                  <span className="text-[10px] text-white/70">swipe down to close</span>
                )}
              </div>
              <textarea
                value={viewer.note || ''}
                onChange={(e) => onUpdateNote(e.target.value)}
                placeholder="Add notes about this image..."
                className="w-full px-2 py-2 rounded-md border border-white/20 bg-black/30 text-white placeholder-white/50 focus:bg-black/40 outline-none min-h-[80px] resize-y text-xs"
                autoFocus={isTouch}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
