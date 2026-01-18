import React from 'react';
import { DESIGN } from '../constants/design';
import { LinkRotatedIcon, StarIcon, FilterIcon } from '../icons';
import type { SyncStatus } from '../syncQueue';

interface HeaderProps {
  isOnline: boolean;
  syncStatus: SyncStatus;
  syncMessage: string;
  copied: boolean;
  showFavOnly: boolean;
  hideEmpty: boolean;
  onShowSlugPrompt: () => void;
  onCopyShare: () => void;
  onToggleFavOnly: () => void;
  onToggleHideEmpty: () => void;
  onScrollToToday: () => void;
  headerRef?: React.RefObject<HTMLDivElement>;
}

export function Header({
  isOnline,
  syncStatus,
  syncMessage,
  copied,
  showFavOnly,
  hideEmpty,
  onShowSlugPrompt,
  onCopyShare,
  onToggleFavOnly,
  onToggleHideEmpty,
  onScrollToToday,
  headerRef,
}: HeaderProps) {
  return (
    <div
      ref={headerRef}
      className="shrink-0 border-b border-white/20"
      style={{
        boxShadow: '0px 4px 4px 0px rgba(0,0,0,0.25)',
      }}
    >
      <div
        className="w-full px-[10px] pb-[10px] flex items-center gap-[15px]"
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 0px), 10px)',
        }}
      >
        {/* Logo */}
        <button
          onClick={onShowSlugPrompt}
          className="flex items-center focus:outline-none shrink-0"
          title="set board name"
        >
          <div
            className="text-white leading-[38px] tracking-[-3px]"
            style={{
              fontFamily: DESIGN.fonts.logo,
              fontSize: '50px',
            }}
          >
            <div>POST</div>
            <div>BILLS</div>
          </div>
        </button>

        {/* Navigation */}
        <div className="flex-1 flex items-center justify-end gap-[10px] relative mt-2">
          {/* Network Status Indicator - Floating above buttons */}
          {!isOnline && (
            <div
              className="absolute -top-[20px] right-0 flex items-center gap-1 pointer-events-none"
              style={{ zIndex: 100 }}
            >
              <div
                className="w-[10px] h-[10px] rounded-full bg-red-500 animate-pulse"
                title="Offline - changes will sync when online"
                aria-label="offline indicator"
              />
              <span className="text-[10px] text-white/90 uppercase tracking-wide font-medium">
                offline
              </span>
            </div>
          )}
          {syncStatus === 'syncing' && isOnline && (
            <div
              className="absolute -top-[20px] right-0 flex items-center gap-1 pointer-events-none"
              style={{ zIndex: 100 }}
            >
              <div
                className="w-[10px] h-[10px] rounded-full bg-yellow-400 animate-pulse"
                title="Syncing changes..."
                aria-label="syncing indicator"
              />
              <span className="text-[10px] text-white/90 uppercase tracking-wide font-medium">
                syncing
              </span>
            </div>
          )}
          {syncStatus === 'success' && isOnline && (
            <div
              className="absolute -top-[20px] right-0 flex items-center gap-1 pointer-events-none"
              style={{ zIndex: 100 }}
            >
              <div
                className="w-[10px] h-[10px] rounded-full bg-green-500"
                title={syncMessage || 'Synced'}
                aria-label="sync success indicator"
              />
              <span className="text-[10px] text-white/90 uppercase tracking-wide font-medium">
                synced
              </span>
            </div>
          )}
          {syncStatus === 'error' && isOnline && (
            <div
              className="absolute -top-[20px] right-0 flex items-center gap-1 pointer-events-none"
              style={{ zIndex: 100 }}
            >
              <div
                className="w-[10px] h-[10px] rounded-full bg-red-500"
                title={syncMessage || 'Sync error'}
                aria-label="sync error indicator"
              />
              <span className="text-[10px] text-white/90 uppercase tracking-wide font-medium">
                error
              </span>
            </div>
          )}

          {/* Link button */}
          <button
            onClick={onCopyShare}
            className="w-[38px] h-[38px] rounded-[6.624px] border-[1.25px] border-white flex items-center justify-center text-white hover:bg-white/10 transition-colors"
            title="copy link"
            aria-label="copy link"
          >
            <LinkRotatedIcon />
          </button>
          {copied && <span className="text-xs text-white/80">copied ✓</span>}

          {/* Star/Favorites button */}
          <button
            onClick={onToggleFavOnly}
            className={`w-[38px] h-[38px] rounded-[6.624px] border-[1.25px] border-white flex items-center justify-center transition-colors ${
              showFavOnly
                ? 'bg-white text-[#0037ae]'
                : 'text-white hover:bg-white/10'
            }`}
            title="show only favorites"
            aria-label="show only favorites"
          >
            <StarIcon filled={showFavOnly} />
          </button>

          {/* Filter button */}
          <button
            onClick={onToggleHideEmpty}
            className={`w-[38px] h-[38px] rounded-[6.624px] border-[1.25px] border-white flex items-center justify-center transition-colors ${
              hideEmpty
                ? 'bg-white text-[#0037ae]'
                : 'text-white hover:bg-white/10'
            }`}
            title="toggle hide empty days"
            aria-label="toggle hide empty days"
          >
            <FilterIcon filled={hideEmpty} />
          </button>

          {/* Today button */}
          <button
            onClick={onScrollToToday}
            className="h-[38px] px-[19.872px] py-[6.624px] rounded-[6.624px] bg-white flex items-center justify-center hover:bg-white/90 transition-colors"
            title="jump to today"
          >
            <span
              className="uppercase font-bold tracking-[0.33px]"
              style={{
                fontFamily: DESIGN.fonts.nav,
                fontSize: '19.872px',
                color: DESIGN.colors.mainBlue,
              }}
            >
              today
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
