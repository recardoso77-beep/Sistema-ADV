import { CloudStorageProvider } from "../interfaces/CloudStorageProvider";
import { DropboxProvider } from "../dropbox/DropboxProvider";
import { GoogleDriveProvider } from "../google/GoogleDriveProvider";
import { OneDriveProvider } from "../onedrive/OneDriveProvider";
import { DB } from "../../../db";

export class StorageFactory {
  static async getProvider(lawFirmId: string): Promise<CloudStorageProvider | null> {
    const firms = await DB.table("law_firms").find((f) => f.id === lawFirmId);
    if (!firms || firms.length === 0) {
      throw new Error("Escritório não encontrado.");
    }
    const firm = firms[0];
    const provider = firm.cloud_provider || "none";

    if (provider === "dropbox") {
      const token = firm.dropbox_access_token;
      const isMock = !firm.dropbox_client_id;
      return new DropboxProvider(token, isMock, lawFirmId);
    } else if (provider === "gdrive") {
      const token = firm.gdrive_access_token;
      const isMock = !firm.gdrive_client_id;
      return new GoogleDriveProvider(token, isMock, lawFirmId);
    } else if (provider === "onedrive") {
      const token = firm.onedrive_access_token;
      const isMock = !firm.onedrive_client_id;
      return new OneDriveProvider(token, isMock, lawFirmId);
    }

    return null;
  }
}
