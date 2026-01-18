import React from 'react';

interface SlugPromptProps {
  slugDraft: string;
  isTouch: boolean;
  onSlugChange: (slug: string) => void;
  onContinue: () => void;
}

export function SlugPrompt({
  slugDraft,
  isTouch,
  onSlugChange,
  onContinue,
}: SlugPromptProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm grid place-items-center p-4"
      role="dialog"
      aria-modal
    >
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-5 space-y-3">
        <div className="text-sm text-neutral-800">
          create/go to existing board
        </div>
        <input
          autoFocus={!isTouch}
          value={slugDraft}
          onChange={(e) =>
            onSlugChange(e.target.value.replace(/[^a-zA-Z0-9-_]/g, '-'))
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
