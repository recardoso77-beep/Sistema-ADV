import { CloudStorageProvider, CloudStorageFile } from "../interfaces/CloudStorageProvider";

export class OneDriveProvider implements CloudStorageProvider {
  private accessToken: string;
  private isMock: boolean;
  private lawFirmId: string;

  constructor(accessToken: string, isMock: boolean, lawFirmId: string) {
    this.accessToken = accessToken || "mock_onedrive_access_token";
    this.isMock = isMock;
    this.lawFirmId = lawFirmId;
  }

  async connect(userId: string): Promise<void> {
    console.log(`OneDriveProvider: connect user ${userId}`);
  }

  async disconnect(userId: string): Promise<void> {
    console.log(`OneDriveProvider: disconnect user ${userId}`);
  }

  async listFiles(folderId?: string): Promise<CloudStorageFile[]> {
    if (this.isMock) {
      return [
        { id: "o1", name: "OneDrive_Minuta_Acordo_Societario_V3.docx", tag: "file", size: 89000, client_modified: "2026-06-28T09:30:00Z" },
        { id: "o2", name: "Procuracao_Ad_Judicia_Previdenciaria.pdf", tag: "file", size: 68000, client_modified: "2026-06-27T16:10:00Z" },
        { id: "o3", name: "Recursos e Apelações de Segunda Instância", tag: "folder" }
      ];
    }

    let url = "https://graph.microsoft.com/v1.0/me/drive/root/children";
    if (folderId && folderId !== "/" && folderId !== "") {
      url = `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children`;
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Erro OneDrive: ${await response.text()}`);
    }

    const data = await response.json() as any;
    return (data.value || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      tag: item.folder ? ("folder" as const) : ("file" as const),
      size: item.size,
      client_modified: item.lastModifiedDateTime,
      path_lower: item.id,
      path_display: item.id,
    }));
  }

  async upload(fileName: string, fileBuffer: Buffer, mimeType?: string): Promise<CloudStorageFile> {
    if (this.isMock) {
      return {
        id: "mock_onedrive_upload_" + Date.now(),
        name: fileName,
        tag: "file",
        size: fileBuffer.length,
        client_modified: new Date().toISOString(),
      };
    }

    // Graph API put file inside drive/root
    const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(fileName)}:/content`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": mimeType || "application/octet-stream",
      },
      body: fileBuffer,
    });

    if (!response.ok) {
      throw new Error(`Erro upload OneDrive: ${await response.text()}`);
    }

    const item = await response.json() as any;
    return {
      id: item.id,
      name: item.name,
      tag: "file",
      size: item.size,
      client_modified: item.lastModifiedDateTime,
    };
  }

  async download(fileId: string): Promise<Buffer> {
    if (this.isMock) {
      return Buffer.from("Conteúdo do arquivo simulado OneDrive");
    }

    const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Erro download OneDrive: ${await response.text()}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async delete(fileId: string): Promise<void> {
    if (this.isMock) return;

    const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Erro exclusão OneDrive: ${await response.text()}`);
    }
  }

  async createFolder(name: string): Promise<string> {
    if (this.isMock) {
      return "mock_onedrive_folder_" + Date.now();
    }

    const response = await fetch("https://graph.microsoft.com/v1.0/me/drive/root/children", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        folder: {},
        "@microsoft.graph.conflictBehavior": "rename",
      }),
    });

    if (!response.ok) {
      throw new Error(`Erro ao criar pasta no OneDrive: ${await response.text()}`);
    }

    const item = await response.json() as any;
    return item.id;
  }

  async rename(fileId: string, name: string): Promise<void> {
    if (this.isMock) return;

    const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      throw new Error(`Erro ao renomear no OneDrive: ${await response.text()}`);
    }
  }

  async move(fileId: string, parentId: string): Promise<void> {
    if (this.isMock) return;

    const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parentReference: {
          id: parentId,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Erro ao mover no OneDrive: ${await response.text()}`);
    }
  }

  async getQuota(): Promise<{ used: number; total: number; used_formatted?: string; total_formatted?: string }> {
    if (this.isMock) {
      return {
        used: 1048576 * 250, // 250MB
        total: 1048576 * 1024 * 5, // 5GB
        used_formatted: "250 MB",
        total_formatted: "5.0 GB",
      };
    }

    const response = await fetch("https://graph.microsoft.com/v1.0/me/drive", {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Erro quota OneDrive: ${await response.text()}`);
    }

    const data = await response.json() as any;
    const used = data.quota?.used || 0;
    const total = data.quota?.total || 1048576 * 1024 * 5;

    return {
      used,
      total,
      used_formatted: `${(used / (1024 * 1024)).toFixed(1)} MB`,
      total_formatted: `${(total / (1024 * 1024 * 1024)).toFixed(1)} GB`,
    };
  }
}
