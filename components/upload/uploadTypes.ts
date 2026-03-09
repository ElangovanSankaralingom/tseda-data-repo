export type UploadMeta = {
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  url: string;
  storedPath: string;
  id?: string;
  name?: string;
  type?: string;
  path?: string;
};

export type EntryUploaderStatus = {
  busy: boolean;
  hasPending: boolean;
};
