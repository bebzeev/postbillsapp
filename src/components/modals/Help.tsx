import { HelpCircle } from 'lucide-react';

interface HelpProps {
  showHelp: boolean;
  onToggleHelp: () => void;
}

export function Help({ showHelp, onToggleHelp }: HelpProps) {
  // Format build timestamp in Eastern Time using document.lastModified
  const buildDate = new Date(document.lastModified);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  const buildTimestamp = formatter.format(buildDate);

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
            className="fixed top-0 left-0 w-full z-40"
            style={{ height: 'var(--app-height, 100dvh)' }}
            onClick={() => onToggleHelp()}
          />
          <div
            className="fixed bottom-16 right-4 z-50 w-80 rounded-xl bg-white shadow-xl border border-neutral-200 p-3 text-[11px] text-neutral-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-medium mb-1 text-xs text-red-600">
              Last build: {buildTimestamp}
            </div>
            <div className="font-medium mb-1.5 mt-2">quick tips</div>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>tap the POSTBILLS logo to create/go to your board.</li>
              <li>copy your link with the link icon.</li>
              <li>drag images from desktop into a day.</li>
              <li>use filters to hide empty/past or show only favorites.</li>
              <li>tap an image to view full-size with options.</li>
              <li>swipe up on an image to add or view notes.</li>
              <li>long press an image to share or save to photos.</li>
              <li>tap today to center the current date.</li>
              <li>add to home screen for an app-like experience (tap share, then "Add to Home Screen").</li>
              <li>tap outside this box to close.</li>
            </ul>
          </div>
        </>
      )}
    </>
  );
}
