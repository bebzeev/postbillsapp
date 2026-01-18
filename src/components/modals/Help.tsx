import { HelpCircle } from 'lucide-react';

interface HelpProps {
  showHelp: boolean;
  onToggleHelp: () => void;
}

export function Help({ showHelp, onToggleHelp }: HelpProps) {
  return (
    <>
      {/* Help Button */}
      <button
        onClick={() => onToggleHelp()}
        className="fixed bottom-4 right-4 z-40 w-10 h-10 rounded-full bg-white shadow-lg grid place-items-center"
        title="help"
        aria-label="help"
      >
        <HelpCircle className="w-5 h-5 text-[#0037ae]" />
      </button>

      {/* Help Popover */}
      {showHelp && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => onToggleHelp()}
          />
          <div
            className="fixed bottom-16 right-4 z-50 w-72 rounded-xl bg-white shadow-xl border border-neutral-200 p-3 text-[12px] text-neutral-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-medium mb-1">quick tips</div>
            <ul className="list-disc pl-4 space-y-1">
              <li>tap the POSTBILLS logo to create/go to your board.</li>
              <li>copy your link with the link icon.</li>
              <li>drag images from desktop into a day.</li>
              <li>use filters to hide empty/past or show only favorites.</li>
              <li>tap today to center the current date.</li>
              <li>tap outside this box to close.</li>
            </ul>
          </div>
        </>
      )}
    </>
  );
}
