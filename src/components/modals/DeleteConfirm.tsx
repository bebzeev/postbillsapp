interface DeleteConfirmProps {
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteConfirm({ onCancel, onConfirm }: DeleteConfirmProps) {
  return (
    <div className="fixed top-0 left-0 w-full z-50 bg-black/40 backdrop-blur-sm grid place-items-center p-4" style={{ height: 'var(--app-height, 100dvh)' }}>
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-5 space-y-4">
        <h3 className="text-lg font-semibold text-neutral-900">
          Delete Image?
        </h3>
        <p className="text-sm text-neutral-600">
          Are you sure you want to delete this image? This action cannot be
          undone.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-neutral-100 text-neutral-800 hover:bg-neutral-200"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
