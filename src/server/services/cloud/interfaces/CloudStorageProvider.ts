export interface CloudStorageFile {
  id: string;
  name: string;
  tag: "file" | "folder";
  size?: number;
  client_modified?: string;
  path_lower?: string;
  path_display?: string;
}

export interface CloudStorageProvider {
  connect(userId: string): Promise<void>;
  disconnect(userId: string): Promise<void>;
  listFiles(folderId?: string): Promise<CloudStorageFile[]>;
  upload(fileName: string, fileBuffer: Buffer, mimeType?: string): Promise<CloudStorageFile>;
  download(fileId: string): Promise<Buffer>;
  delete(fileId: string): Promise<void>;
  createFolder(name: string): Promise<string>;
  rename(fileId: string, name: string): Promise<void>;
  move(fileId: string, parentId: string): Promise<void>;
  getQuota(): Promise<{ used: number; total: number; used_formatted?: string; total_formatted?: string }>;
}
