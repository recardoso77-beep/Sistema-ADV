import { CloudStorageProvider, CloudStorageFile } from "../interfaces/CloudStorageProvider";

export class DropboxProvider implements CloudStorageProvider {
  private accessToken: string;
  private isMock: boolean;
  private lawFirmId: string;

  constructor(accessToken: string, isMock: boolean, lawFirmId: string) {
    this.accessToken = accessToken || "mock_access_token";
    this.isMock = isMock;
    this.lawFirmId = lawFirmId;
  }

  async connect(userId: string): Promise<void> {
    console.log(`DropboxProvider: connect user ${userId}`);
  }

  async disconnect(userId: string): Promise<void> {
    console.log(`DropboxProvider: disconnect user ${userId}`);
  }

  async listFiles(folderId?: string): Promise<CloudStorageFile[]> {
    if (this.isMock) {
      // Simulate folder list matching structure
      const mockList = [
        { id: "1", name: "Contrato_Prestacao_Servicos_Sportix_2026.pdf", tag: "file" as const, size: 154200, client_modified: "2026-06-12T14:32:00Z", path_lower: "/contrato_prestacao_servicos_sportix_2026.pdf" },
        { id: "2", name: "Peticao_Inicial_Reclamacao_Trabalhista_Carlos.pdf", tag: "file" as const, size: 240500, client_modified: "2026-06-20T09:15:00Z", path_lower: "/peticao_inicial_reclamacao_trabalhista_carlos.pdf" },
        { id: "3", name: "Modelos de Petições Jurídicas", tag: "folder" as const, path_lower: "/modelos_de_peticoes_juridicas" },
        { id: "4", name: "Contratos Sociais e Procurações", tag: "folder" as const, path_lower: "/contratos_sociais_e_procuracoes" }
      ];
      return mockList;
    }

    const response = await fetch("https://api.dropboxapi.com/2/files/list_folder", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path: folderId || "", recursive: false }),
    });

    if (!response.ok) {
      throw new Error(`Erro Dropbox: ${await response.text()}`);
    }

    const data = await response.json() as any;
    return (data.entries || []).map((e: any) => ({
      id: e.id,
      name: e.name,
      tag: e[".tag"] === "folder" ? "folder" : "file",
      size: e.size,
      client_modified: e.client_modified,
      path_lower: e.path_lower,
      path_display: e.path_display,
    }));
  }

  async upload(fileName: string, fileBuffer: Buffer, mimeType?: string): Promise<CloudStorageFile> {
    if (this.isMock) {
      return {
        id: "mock_uploaded_db_" + Date.now(),
        name: fileName,
        tag: "file",
        size: fileBuffer.length,
        client_modified: new Date().toISOString(),
      };
    }

    const response = await fetch("https://content.dropboxapi.com/2/files/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({
          path: `/${fileName}`,
          mode: "overwrite",
          autorename: true,
          mute: false,
        }),
      },
      body: fileBuffer,
    });

    if (!response.ok) {
      throw new Error(`Erro upload Dropbox: ${await response.text()}`);
    }

    const e = await response.json() as any;
    return {
      id: e.id,
      name: e.name,
      tag: "file",
      size: e.size,
      client_modified: e.client_modified,
      path_lower: e.path_lower,
      path_display: e.path_display,
    };
  }

  async download(fileId: string): Promise<Buffer> {
    if (this.isMock) {
      return Buffer.from("Conteúdo do arquivo simulado Dropbox");
    }

    const response = await fetch("https://content.dropboxapi.com/2/files/download", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Dropbox-API-Arg": JSON.stringify({ path: fileId }),
      },
    });

    if (!response.ok) {
      throw new Error(`Erro download Dropbox: ${await response.text()}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async delete(fileId: string): Promise<void> {
    if (this.isMock) return;

    const response = await fetch("https://api.dropboxapi.com/2/files/delete_v2", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path: fileId }),
    });

    if (!response.ok) {
      throw new Error(`Erro exclusão Dropbox: ${await response.text()}`);
    }
  }

  async createFolder(name: string): Promise<string> {
    if (this.isMock) {
      return "mock_folder_db_" + Date.now();
    }

    const response = await fetch("https://api.dropboxapi.com/2/files/create_folder_v2", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path: `/${name}`, autorename: true }),
    });

    if (!response.ok) {
      throw new Error(`Erro ao criar pasta no Dropbox: ${await response.text()}`);
    }

    const data = await response.json() as any;
    return data.metadata.id;
  }

  async rename(fileId: string, name: string): Promise<void> {
    if (this.isMock) return;

    const parts = fileId.split("/");
    parts[parts.length - 1] = name;
    const newPath = parts.join("/");

    const response = await fetch("https://api.dropboxapi.com/2/files/move_v2", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from_path: fileId, to_path: newPath }),
    });

    if (!response.ok) {
      throw new Error(`Erro ao renomear no Dropbox: ${await response.text()}`);
    }
  }

  async move(fileId: string, parentId: string): Promise<void> {
    if (this.isMock) return;

    const fileName = fileId.split("/").pop() || "arquivo";
    const toPath = `${parentId.replace(/\/$/, "")}/${fileName}`;

    const response = await fetch("https://api.dropboxapi.com/2/files/move_v2", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from_path: fileId, to_path: toPath }),
    });

    if (!response.ok) {
      throw new Error(`Erro ao mover no Dropbox: ${await response.text()}`);
    }
  }

  async getQuota(): Promise<{ used: number; total: number; used_formatted?: string; total_formatted?: string }> {
    if (this.isMock) {
      return {
        used: 1048576 * 150, // 150MB
        total: 1048576 * 1024 * 2, // 2GB
        used_formatted: "150 MB",
        total_formatted: "2.0 GB",
      };
    }

    const response = await fetch("https://api.dropboxapi.com/2/users/get_space_usage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Erro quota Dropbox: ${await response.text()}`);
    }

    const data = await response.json() as any;
    const used = data.used || 0;
    const total = data.allocation?.allocated || 1048576 * 1024 * 2;

    return {
      used,
      total,
      used_formatted: `${(used / (1024 * 1024)).toFixed(1)} MB`,
      total_formatted: `${(total / (1024 * 1024 * 1024)).toFixed(1)} GB`,
    };
  }
}
