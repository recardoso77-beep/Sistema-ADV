import { CloudStorageProvider, CloudStorageFile } from "../interfaces/CloudStorageProvider";

export class GoogleDriveProvider implements CloudStorageProvider {
  private accessToken: string;
  private isMock: boolean;
  private lawFirmId: string;

  constructor(accessToken: string, isMock: boolean, lawFirmId: string) {
    this.accessToken = accessToken || "mock_gdrive_access_token";
    this.isMock = isMock;
    this.lawFirmId = lawFirmId;
  }

  async connect(userId: string): Promise<void> {
    console.log(`GoogleDriveProvider: connect user ${userId}`);
  }

  async disconnect(userId: string): Promise<void> {
    console.log(`GoogleDriveProvider: disconnect user ${userId}`);
  }

  async listFiles(folderId?: string): Promise<CloudStorageFile[]> {
    if (this.isMock) {
      return [
        { id: "g1", name: "GoogleDrive_Contrato_Honorarios_AALL.pdf", tag: "file", size: 185000, client_modified: "2026-06-25T10:00:00Z" },
        { id: "g2", name: "Calculos_Liquidacao_Trabalhista_Revisados.xlsx", tag: "file", size: 112000, client_modified: "2026-06-26T15:20:00Z" },
        { id: "g3", name: "Processos Cíveis - Documentos de Prova", tag: "folder" }
      ];
    }

    let q = `'root' in parents and trashed = false`;
    if (folderId && folderId !== "/" && folderId !== "") {
      q = `'${folderId}' in parents and trashed = false`;
    }

    const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size,modifiedTime)`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Erro Google Drive: ${await response.text()}`);
    }

    const data = await response.json() as any;
    return (data.files || []).map((f: any) => {
      const isFolder = f.mimeType === "application/vnd.google-apps.folder";
      return {
        id: f.id,
        name: f.name,
        tag: isFolder ? ("folder" as const) : ("file" as const),
        size: f.size ? Number(f.size) : undefined,
        client_modified: f.modifiedTime,
        path_lower: f.id,
        path_display: f.id,
      };
    });
  }

  async upload(fileName: string, fileBuffer: Buffer, mimeType?: string): Promise<CloudStorageFile> {
    if (this.isMock) {
      return {
        id: "mock_gdrive_upload_" + Date.now(),
        name: fileName,
        tag: "file",
        size: fileBuffer.length,
        client_modified: new Date().toISOString(),
      };
    }

    // Google Drive multipart upload or simple media upload
    const metadata = {
      name: fileName,
      parents: [] as string[],
    };

    const boundary = "gdrive_upload_boundary";
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartBody = Buffer.concat([
      Buffer.from(delimiter + "Content-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify(metadata) + "\r\n"),
      Buffer.from(delimiter + `Content-Type: ${mimeType || "application/octet-stream"}\r\n\r\n`),
      fileBuffer,
      Buffer.from(closeDelimiter),
    ]);

    const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    });

    if (!response.ok) {
      throw new Error(`Erro upload Google Drive: ${await response.text()}`);
    }

    const f = await response.json() as any;
    return {
      id: f.id,
      name: f.name,
      tag: "file",
      size: f.size ? Number(f.size) : undefined,
      client_modified: f.modifiedTime,
    };
  }

  async download(fileId: string): Promise<Buffer> {
    if (this.isMock) {
      return Buffer.from("Conteúdo do arquivo simulado Google Drive");
    }

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Erro download Google Drive: ${await response.text()}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async delete(fileId: string): Promise<void> {
    if (this.isMock) return;

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Erro exclusão Google Drive: ${await response.text()}`);
    }
  }

  async createFolder(name: string): Promise<string> {
    if (this.isMock) {
      return "mock_gdrive_folder_" + Date.now();
    }

    const response = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
      }),
    });

    if (!response.ok) {
      throw new Error(`Erro ao criar pasta no Google Drive: ${await response.text()}`);
    }

    const f = await response.json() as any;
    return f.id;
  }

  async rename(fileId: string, name: string): Promise<void> {
    if (this.isMock) return;

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      throw new Error(`Erro ao renomear no Google Drive: ${await response.text()}`);
    }
  }

  async move(fileId: string, parentId: string): Promise<void> {
    if (this.isMock) return;

    // Google Drive requires fetching the current parents first or using addParents/removeParents
    const getFileResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=parents`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!getFileResponse.ok) {
      throw new Error("Erro ao carregar pais do arquivo no Google Drive");
    }
    const fileInfo = await getFileResponse.json() as any;
    const currentParents = (fileInfo.parents || []).join(",");

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${parentId}&removeParents=${currentParents}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Erro ao mover no Google Drive: ${await response.text()}`);
    }
  }

  async getQuota(): Promise<{ used: number; total: number; used_formatted?: string; total_formatted?: string }> {
    if (this.isMock) {
      return {
        used: 1048576 * 450, // 450MB
        total: 1048576 * 1024 * 15, // 15GB
        used_formatted: "450 MB",
        total_formatted: "15 GB",
      };
    }

    const response = await fetch("https://www.googleapis.com/drive/v3/about?fields=storageQuota", {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Erro quota Google Drive: ${await response.text()}`);
    }

    const data = await response.json() as any;
    const limit = Number(data.storageQuota?.limit) || 1048576 * 1024 * 15;
    const usage = Number(data.storageQuota?.usage) || 0;

    return {
      used: usage,
      total: limit,
      used_formatted: `${(usage / (1024 * 1024)).toFixed(1)} MB`,
      total_formatted: `${(limit / (1024 * 1024 * 1024)).toFixed(1)} GB`,
    };
  }
}
