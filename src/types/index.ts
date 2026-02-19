export interface ImageItem {
  id: string;
  name: string;
  dataUrl: string;
  /** Original Firebase Storage HTTPS URL (for notification attachments) */
  imageURL?: string;
  fav: boolean;
  note: string;
  _order?: number;
}

export interface Board {
  [key: string]: ImageItem[];
}

export interface Viewer {
  url: string;
  name: string;
  dayKey: string;
  id: string;
  fav: boolean;
  note: string;
}

export interface DeleteConfirmState {
  dayKey: string;
  id: string;
}

export interface CopyFeedback {
  show: boolean;
  type: string;
  x: number;
  y: number;
}

export interface ExternalHover {
  dayKey: string | null;
  index: number | null;
}
