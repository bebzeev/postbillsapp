import React from 'react';
import { X } from 'lucide-react';

interface SlugPromptProps {
  slugDraft: string;
  isTouch: boolean;
  onSlugChange: (slug: string) => void;
  onContinue: () => void;
  canDismiss?: boolean;
  onDismiss?: () => void;
}

export function SlugPrompt({
  slugDraft,
  isTouch,
  onSlugChange,
  onContinue,
  canDismiss = false,
  onDismiss,
}: SlugPromptProps) {
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (canDismiss && onDismiss && e.target === e.currentTarget) {
      onDismiss();
    }
  };

  return (
    <div
      className={`fixed top-0 left-0 w-full z-50 bg-black/40 backdrop-blur-sm grid place-items-center p-4 ${canDismiss ? 'cursor-pointer' : ''}`}
      style={{ height: 'var(--app-height, 100dvh)' }}
      role="dialog"
      aria-modal
      onClick={handleBackdropClick}
    >
      <div 
        className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-5 space-y-3 cursor-default relative"
        onClick={(e) => e.stopPropagation()}
      >
        {canDismiss && onDismiss && (
          <button
            onClick={onDismiss}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 grid place-items-center transition-colors"
            title="close"
            aria-label="close"
          >
            <X className="w-4 h-4 text-neutral-600" />
          </button>
        )}
        <div className="text-sm text-neutral-800">
          create/go to existing board
        </div>
        <input
          autoFocus={!isTouch}
          value={slugDraft}
          onChange={(e) =>
            onSlugChange(e.target.value.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase())
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter' && slugDraft) {
              onContinue();
            }
          }}
          className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white outline-none"
        />
        <div className="text-[12px] text-neutral-500">
          tap the POSTBILLS logo anytime to name/switch boards. we'll update the
          url to /your-slug. bookmark it. anyone with the link can view/edit.
        </div>
        <div className="flex gap-2 justify-end">
          <button
            disabled={!slugDraft}
            onClick={onContinue}
            className="px-3 py-1.5 rounded-lg bg-[#0037ae] text-white disabled:opacity-50"
          >
            continue
          </button>
        </div>
      </div>
    </div>
  );
}
