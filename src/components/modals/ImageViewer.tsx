import React from 'react';
import { motion } from 'framer-motion';
import { X, Trash2, Star, Link2, FileText } from 'lucide-react';
import type { Viewer } from '../../types';

interface ImageViewerProps {
  viewer: Viewer;
  showNotes: boolean;
  isTouch: boolean;
  onClose: () => void;
  onDelete: () => void;
  onToggleFav: () => void;
  onCopyLink: (e: React.MouseEvent) => void;
  onToggleNotes: () => void;
  onUpdateNote: (note: string) => void;
}

export function ImageViewer({
  viewer,
  showNotes,
  isTouch,
  onClose,
  onDelete,
  onToggleFav,
  onCopyLink,
  onToggleNotes,
  onUpdateNote,
}: ImageViewerProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-8"
      style={{
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        minHeight: '100dvh',
        paddingBottom: `calc(2rem + env(safe-area-inset-bottom, 0px))`,
      }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="fixed top-4 right-4 z-[60] w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 grid place-items-center transition-all"
        title="close"
        aria-label="close"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      <div className="relative max-w-4xl w-full flex flex-col items-center gap-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex justify-center group min-h-[200px]"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={viewer.url}
            alt={viewer.name || 'flyer'}
            className="max-w-full max-h-[60vh] object-contain rounded-[10px] shadow-2xl"
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
                onCopyLink(e);
              }}
              className="w-10 h-10 rounded-full bg-white shadow-lg grid place-items-center"
              title="copy link"
              aria-label="copy link"
            >
              <Link2 className="w-5 h-5 text-[#0037ae]" />
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

        {showNotes && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{
              duration: 0.25,
              delay: 0.1,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="w-full max-w-2xl p-4 rounded-lg bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Notes
            </label>
            <textarea
              value={viewer.note || ''}
              onChange={(e) => onUpdateNote(e.target.value)}
              placeholder="Add notes about this image..."
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white outline-none min-h-[100px] resize-y"
            />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
