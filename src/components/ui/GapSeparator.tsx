interface GapSeparatorProps {
  thin?: boolean;
}

export const GapSeparator = ({ thin = false }: GapSeparatorProps) => (
  <div
    className={`${thin ? 'mx-2' : 'mx-4'} h-full flex items-center`}
    aria-hidden
  >
    <div
      className={`${thin ? 'w-[2px]' : 'w-[3px]'} bg-white/30`}
      style={{ height: '80%' }}
    />
  </div>
);
