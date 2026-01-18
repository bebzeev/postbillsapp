import { AnimatePresence, motion } from 'framer-motion';
import type { CopyFeedback as CopyFeedbackType } from '../../types';

interface CopyFeedbackProps {
  copyFeedback: CopyFeedbackType;
}

export function CopyFeedback({ copyFeedback }: CopyFeedbackProps) {
  return (
    <AnimatePresence>
      {copyFeedback.show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, x: -10 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            left: copyFeedback.x,
            top: copyFeedback.y,
            zIndex: 9999,
          }}
          className="bg-[#0037ae] text-white text-xs px-3 py-1.5 rounded-full shadow-lg font-medium whitespace-nowrap"
        >
          {copyFeedback.type === 'image'
            ? 'Image downloaded!'
            : 'Link copied!'}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
