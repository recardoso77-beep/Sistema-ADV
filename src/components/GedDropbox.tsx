import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
  Folder, 
  FileText, 
  Search, 
  RefreshCw, 
  LogOut, 
  ArrowLeft, 
  ExternalLink, 
  Database, 
  CheckCircle2, 
  ChevronRight, 
  AlertCircle, 
  HelpCircle, 
  File, 
  Settings, 
  Key, 
  Lock, 
  Cloud, 
  Plus, 
  Trash2, 
  Edit3, 
  Move, 
  Upload, 
  Download, 
  Eye 
} from "lucide-react";
import { Client, Process } from "../types";

interface GedDropboxProps {
  clients: Client[];
  processes: Process[];
  token: string;
  onRefresh: () => void;
}

interface CloudItem {
  ".tag": "file" | "folder";
  name: string;
  path_lower: string;
  path_display: string;
  size?: number;
  client_modified?: string;
  id?: string;
}

interface ProviderStatus {
  connected: boolean;
  email: string | null;
  mockMode: boolean;
  used?: number;
  total?: number;
  used_formatted?: string;
  total_formatted?: string;
}

interface StatusResponse {
  activeProvider: string;
  providers: {
    dropbox: ProviderStatus;
    gdrive: ProviderStatus;
    onedrive: ProviderStatus;
  };
}

const providerDetails: Record<string, {
  name: string;
  color: string;
  borderColor: string;
  bgGradient: string;
  textColor: string;
  accentColor: string;
  icon: (className?: string) => React.ReactNode;
  description: string;
}> = {
  dropbox: {
    name: "Dropbox",
    color: "blue",
    borderColor: "border-blue-500/20",
    bgGradient: "from-blue-600/10 to-indigo-600/5",
    textColor: "text-blue-400",
    accentColor: "bg-blue-600 hover:bg-blue-500",
    icon: (className = "w-5 h-5") => (
      <svg className={`${className} fill-current text-blue-400`} viewBox="0 0 24 24">
        <path d="M5.962 3L1.05 6.13l3.968 3.178L12 4.931 5.962 3zM1.05 12.441l4.912 3.13 6.038-4.377-7.006-4.377-3.944 5.624zm10.95 2.181l5.962-4.377 3.968 3.13-7.006 4.377-2.924-3.13zm6.038-11.622L22.95 6.13 18.038 9.308 12 4.931l6.038-1.931zM12 11.194l7.006-4.377 3.944 5.624-4.912 3.13-6.038-4.377zm-4.376 6.309l4.376 2.454 4.376-2.454L12 15.34l-4.376 2.163z" />
      </svg>
    ),
    description: "Ideal para sincronizar e gerenciar petições, procurações e contratos armazenados na sua conta Dropbox corporativa.",
  },
  gdrive: {
    name: "Google Drive",
    color: "emerald",
    borderColor: "border-emerald-500/20",
    bgGradient: "from-emerald-600/10 to-teal-600/5",
    textColor: "text-emerald-400",
    accentColor: "bg-emerald-600 hover:bg-emerald-500",
    icon: (className = "w-5 h-5") => (
      <svg className={`${className} fill-current text-emerald-400`} viewBox="0 0 24 24">
        <path d="M19.43 12.98l-6.73-11.66c-.37-.64-1.03-1.03-1.78-1.03h-1.84c-.75 0-1.41.39-1.78 1.03l-6.73 11.66c-.37.64-.37 1.42 0 2.06l1.84 3.18c.37.64 1.03 1.03 1.78 1.03h13.46c.75 0 1.41-.39 1.78-1.03l1.84-3.18c.37-.64.37-1.42 0-2.06zM11.5 4.5l5.5 9.5H6l5.5-9.5z" />
      </svg>
    ),
    description: "Sincronize automaticamente seus arquivos de petições, laudos e contratos diretamente do Google Workspace.",
  },
  onedrive: {
    name: "OneDrive",
    color: "sky",
    borderColor: "border-sky-500/20",
    bgGradient: "from-sky-600/10 to-blue-500/5",
    textColor: "text-sky-400",
    accentColor: "bg-sky-600 hover:bg-sky-500",
    icon: (className = "w-5 h-5") => (
      <svg className={`${className} fill-current text-sky-400`} viewBox="0 0 24 24">
        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z" />
      </svg>
    ),
    description: "Integração completa com o Microsoft 365 para gerenciar as pastas de arquivos e documentos jurídicos da banca.",
  }
};

export default function GedDropbox({ clients, processes, token, onRefresh }: GedDropboxProps) {
  // Global connection state for all 3 providers
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [activeExplorer, setActiveExplorer] = useState<"dropbox" | "gdrive" | "onedrive">("dropbox");
  
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // File explorer state
  const [currentPath, setCurrentPath] = useState<string>("");
  const [pathHistory, setPathHistory] = useState<string[]>([]);
  const [items, setItems] = useState<CloudItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [importingFile, setImportingFile] = useState<CloudItem | null>(null);
  const [importCategory, setImportCategory] = useState("Contrato");
  const [importClientId, setImportClientId] = useState("");
  const [importProcessId, setImportProcessId] = useState("");
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);

  // New folder modal
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // Rename modal
  const [renamingItem, setRenamingItem] = useState<CloudItem | null>(null);
  const [renameNewName, setRenameNewName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  // Move modal
  const [movingItem, setMovingItem] = useState<CloudItem | null>(null);
  const [moveTargetPath, setMoveTargetPath] = useState("");
  const [isMoving, setIsMoving] = useState(false);

  // New Petition File modal
  const [isNewFileModalOpen, setIsNewFileModalOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileContent, setNewFileContent] = useState("");
  const [isCreatingFile, setIsCreatingFile] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check connection status of all cloud accounts
  const checkStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    try {
      const res = await fetch("/api/cloud/status", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        // Automatically select the active provider or first connected provider for the file explorer
        if (data.activeProvider && data.activeProvider !== "none") {
          setActiveExplorer(data.activeProvider);
        } else {
          const connected = Object.keys(data.providers).find(
            (key) => data.providers[key as any]?.connected
          );
          if (connected) {
            setActiveExplorer(connected as any);
          }
        }
      }
    } catch (err: any) {
      console.error("Error checking cloud status:", err);
      setError("Não foi possível carregar os status das contas de armazenamento.");
    } finally {
      setIsLoadingStatus(false);
    }
  }, [token]);

  // Load items for the explorer
  const fetchItems = useCallback(async (path: string, provider: string) => {
    setIsLoadingFiles(true);
    setError(null);
    try {
      const res = await fetch("/api/cloud/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ path, provider }),
      });

      if (!res.ok) {
        throw new Error("Erro ao listar os arquivos do provedor.");
      }

      const data = await res.json();
      setItems(data.entries || []);
    } catch (err: any) {
      console.error("Error loading items:", err);
      setError("Falha ao obter documentos da nuvem. Verifique sua conexão.");
    } finally {
      setIsLoadingFiles(false);
    }
  }, [token]);

  // Load files when explorer provider or path changes
  useEffect(() => {
    if (status?.providers[activeExplorer]?.connected) {
      fetchItems(currentPath, activeExplorer);
    } else {
      setItems([]);
    }
  }, [activeExplorer, currentPath, fetchItems, status]);

  useEffect(() => {
    checkStatus();
  }, [token, checkStatus]);

  // Handle message from OAuth popup to refresh connection status immediately
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      if (
        event.data?.type === "CLOUD_AUTH_SUCCESS" || 
        event.data?.type === "DROPBOX_AUTH_SUCCESS" ||
        event.data?.type?.endsWith("_AUTH_SUCCESS")
      ) {
        checkStatus();
      }
    };
    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, [checkStatus]);

  // Generate OAuth URL and Open Popup
  const handleConnect = async (provider: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/cloud/auth-url?provider=${provider}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Não foi possível gerar a URL de autorização.");
      }

      const { url } = await res.json();
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const authWindow = window.open(
        url,
        `${provider}_oauth_popup`,
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
      );

      if (!authWindow) {
        alert("O bloqueador de pop-ups impediu o login. Por favor, libere pop-ups para este site.");
      }
    } catch (err: any) {
      setError(err.message || `Erro ao iniciar autenticação com o ${provider}.`);
    }
  };

  // Disconnect Cloud Provider
  const handleDisconnect = async (provider: string) => {
    const details = providerDetails[provider];
    if (!window.confirm(`Deseja realmente desconectar sua conta do ${details?.name || provider}?`)) {
      return;
    }

    setError(null);
    try {
      const res = await fetch("/api/cloud/disconnect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ provider }),
      });
      if (res.ok) {
        checkStatus();
        if (activeExplorer === provider) {
          setCurrentPath("");
          setPathHistory([]);
          setItems([]);
        }
      } else {
        throw new Error("Erro ao desconectar conta.");
      }
    } catch (err: any) {
      setError(err.message || `Falha ao desconectar o ${provider}.`);
    }
  };

  // Search items in place or through server
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      fetchItems(currentPath, activeExplorer);
      return;
    }

    setIsLoadingFiles(true);
    try {
      const res = await fetch(`/api/cloud/list?search=${encodeURIComponent(query)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ path: currentPath, provider: activeExplorer }),
      });

      if (res.ok) {
        const data = await res.json();
        setItems(data.entries || []);
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Folder navigation
  const handleFolderClick = (folder: CloudItem) => {
    const newPath = folder.path_display;
    setPathHistory((prev) => [...prev, currentPath]);
    setCurrentPath(newPath);
    setSearchQuery("");
  };

  const handleGoBack = () => {
    if (pathHistory.length === 0) return;
    const previous = pathHistory[pathHistory.length - 1];
    setPathHistory((prev) => prev.slice(0, -1));
    setCurrentPath(previous);
    setSearchQuery("");
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      setCurrentPath("");
      setPathHistory([]);
      setSearchQuery("");
      return;
    }
    const newHistory = pathHistory.slice(0, index + 1);
    const targetPath = pathHistory[index];
    setPathHistory(newHistory.slice(0, -1));
    setCurrentPath(targetPath);
    setSearchQuery("");
  };

  // View / Open File Link
  const handleViewFile = async (file: CloudItem) => {
    setError(null);
    try {
      const res = await fetch("/api/cloud/get-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ path: file.path_display, provider: activeExplorer }),
      });

      if (!res.ok) {
        throw new Error("Não foi possível obter o link seguro do arquivo.");
      }

      const data = await res.json();
      window.open(data.link, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      setError(err.message || "Erro ao visualizar o arquivo.");
    }
  };

  // Import file to LegalOne ERP
  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importingFile) return;

    setImporting(true);
    setImportSuccess(false);
    setError(null);

    try {
      const linkRes = await fetch("/api/cloud/get-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ path: importingFile.path_display, provider: activeExplorer }),
      });

      if (!linkRes.ok) {
        throw new Error("Erro ao obter link seguro do documento para integração.");
      }

      const linkData = await linkRes.json();

      const docPayload = {
        name: importingFile.name,
        category: importCategory,
        file_path: linkData.link,
        process_id: importProcessId || null,
        client_id: importClientId || null,
        version: 1,
      };

      const res = await fetch("/api/documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(docPayload),
      });

      if (!res.ok) {
        throw new Error("Erro ao salvar o documento no banco de dados.");
      }

      setImportSuccess(true);
      onRefresh(); // Refresh documents in parents
      
      setTimeout(() => {
        setImportingFile(null);
        setImportSuccess(false);
        setImportClientId("");
        setImportProcessId("");
      }, 2000);

    } catch (err: any) {
      console.error("Import error:", err);
      setError(err.message || "Falha ao importar documento.");
    } finally {
      setImporting(false);
    }
  };

  // Handle File Upload
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const localFile = e.target.files?.[0];
    if (!localFile) return;

    setError(null);
    setIsLoadingFiles(true);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const fileContent = reader.result as string;

        const res = await fetch("/api/cloud/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fileName: localFile.name,
            fileContent: fileContent,
            provider: activeExplorer,
            currentPath: currentPath
          }),
        });

        if (!res.ok) {
          throw new Error("Erro ao enviar arquivo para o provedor.");
        }

        fetchItems(currentPath, activeExplorer);
      };

      // Read as text or simulated content
      reader.readAsText(localFile);
    } catch (err: any) {
      setError(err.message || "Falha ao enviar documento.");
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Handle Delete File / Folder
  const handleDeleteItem = async (item: CloudItem) => {
    if (!window.confirm(`Deseja realmente excluir permanentemente "${item.name}"?`)) {
      return;
    }

    setError(null);
    setIsLoadingFiles(true);
    try {
      const res = await fetch("/api/cloud/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          path: item.path_display,
          provider: activeExplorer
        })
      });

      if (!res.ok) {
        throw new Error("Erro ao excluir arquivo.");
      }

      fetchItems(currentPath, activeExplorer);
    } catch (err: any) {
      setError(err.message || "Falha ao excluir item.");
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Handle Create Folder
  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    setIsCreatingFolder(true);
    setError(null);
    try {
      const res = await fetch("/api/cloud/create-folder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newFolderName,
          provider: activeExplorer,
          currentPath: currentPath
        })
      });

      if (!res.ok) {
        throw new Error("Erro ao criar nova pasta.");
      }

      setIsFolderModalOpen(false);
      setNewFolderName("");
      fetchItems(currentPath, activeExplorer);
    } catch (err: any) {
      setError(err.message || "Erro ao criar nova pasta.");
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // Handle Create New Petition (File)
  const handleCreateFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;

    setIsCreatingFile(true);
    setError(null);
    try {
      const finalName = newFileName.endsWith(".docx") || newFileName.endsWith(".pdf") || newFileName.endsWith(".txt") 
        ? newFileName 
        : `${newFileName}.docx`;

      const res = await fetch("/api/cloud/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileName: finalName,
          fileContent: newFileContent || "Minuta jurídica criada dinamicamente via módulo de petições.",
          provider: activeExplorer,
          currentPath: currentPath
        })
      });

      if (!res.ok) {
        throw new Error("Erro ao criar documento.");
      }

      setIsNewFileModalOpen(false);
      setNewFileName("");
      setNewFileContent("");
      fetchItems(currentPath, activeExplorer);
    } catch (err: any) {
      setError(err.message || "Falha ao criar petição.");
    } finally {
      setIsCreatingFile(false);
    }
  };

  // Handle Rename Item
  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingItem || !renameNewName.trim()) return;

    setIsRenaming(true);
    setError(null);
    try {
      const res = await fetch("/api/cloud/rename", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          path: renamingItem.path_display,
          name: renameNewName,
          provider: activeExplorer
        })
      });

      if (!res.ok) {
        throw new Error("Erro ao renomear arquivo.");
      }

      setRenamingItem(null);
      setRenameNewName("");
      fetchItems(currentPath, activeExplorer);
    } catch (err: any) {
      setError(err.message || "Falha ao renomear item.");
    } finally {
      setIsRenaming(false);
    }
  };

  // Handle Move Item
  const handleMoveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movingItem) return;

    setIsMoving(true);
    setError(null);
    try {
      const res = await fetch("/api/cloud/move", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          path: movingItem.path_display,
          targetPath: moveTargetPath,
          provider: activeExplorer
        })
      });

      if (!res.ok) {
        throw new Error("Erro ao mover arquivo.");
      }

      setMovingItem(null);
      setMoveTargetPath("");
      fetchItems(currentPath, activeExplorer);
    } catch (err: any) {
      setError(err.message || "Falha ao mover item.");
    } finally {
      setIsMoving(false);
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return "0 KB";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const currentProviderStatus = status?.providers[activeExplorer];

  return (
    <div className="space-y-6" id="cloud-storage-module">
      
      {/* 1. Header Hero Block */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-xl shadow-slate-950/20">
        <div className="absolute right-0 top-0 w-64 h-64 bg-slate-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-600/10 text-indigo-400 rounded-xl">
              <Cloud className="w-5 h-5 animate-pulse" />
            </span>
            <h1 className="text-xl font-bold text-slate-100 font-sans tracking-tight">Armazenamento em Nuvem</h1>
          </div>
          <p className="text-xs text-slate-400 max-w-xl">
            Modulo integrado de Gestão Eletrônica de Documentos (GED). Vincule suas contas de armazenamento em nuvem prediletas para centralizar o arquivo da banca.
          </p>
        </div>

        <button
          onClick={checkStatus}
          disabled={isLoadingStatus}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/50 rounded-xl text-xs font-semibold cursor-pointer transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStatus ? "animate-spin" : ""}`} />
          Sincronizar Status
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-950/30 border border-red-500/20 text-red-300 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Bento-Style Connection Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5" id="provider-cards-grid">
        {Object.entries(providerDetails).map(([key, provider]) => {
          const provStatus: ProviderStatus = status?.providers[key as any] || {
            connected: false,
            email: null,
            mockMode: true,
            used: 0,
            total: 2 * 1024 * 1024 * 1024,
            used_formatted: "0 B",
            total_formatted: "2 GB"
          };

          const isExplorerActive = activeExplorer === key && provStatus.connected;

          // Calculate percentage for progress bar
          const usedBytes = provStatus.used || 0;
          const totalBytes = provStatus.total || 2 * 1024 * 1024 * 1024;
          const percentUsed = Math.min(100, Math.round((usedBytes / totalBytes) * 100)) || 5;

          return (
            <div 
              key={key} 
              id={`provider-card-${key}`}
              className={`bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all duration-200 relative overflow-hidden ${
                isExplorerActive ? "border-indigo-500 ring-1 ring-indigo-500/25 shadow-lg shadow-indigo-500/5" : "border-slate-800/80 hover:border-slate-700"
              }`}
            >
              <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${provider.bgGradient} rounded-full blur-2xl pointer-events-none`}></div>
              
              <div className="space-y-3">
                {/* Brand & Badge Status */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2.5">
                    <div className="h-10 w-10 bg-slate-950 border border-slate-800/60 rounded-xl flex items-center justify-center">
                      {provider.icon("w-5 h-5")}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-100 font-sans">{provider.name}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${provStatus.connected ? "bg-emerald-500 animate-pulse" : "bg-slate-500"}`}></span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {provStatus.connected ? "Conta Conectada" : "Desconectado"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {provStatus.connected && (
                    <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      ✓ Ativo
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed font-normal min-h-[44px]">
                  {provider.description}
                </p>

                {/* Quota details if connected */}
                {provStatus.connected && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Espaço Utilizado:</span>
                      <span className="font-semibold text-slate-200">{provStatus.used_formatted} de {provStatus.total_formatted}</span>
                    </div>
                    <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          percentUsed > 85 ? "bg-red-500" : percentUsed > 60 ? "bg-amber-500" : "bg-indigo-500"
                        }`}
                        style={{ width: `${percentUsed}%` }}
                      ></div>
                    </div>
                    <span className="text-[9px] text-slate-500 block truncate font-mono">Conta: {provStatus.email}</span>
                  </div>
                )}
              </div>

              {/* Card Actions */}
              <div className="pt-2 flex flex-wrap gap-2">
                {provStatus.connected ? (
                  <>
                    <button
                      onClick={() => {
                        setActiveExplorer(key as any);
                        setCurrentPath("");
                        setPathHistory([]);
                      }}
                      className={`flex-1 px-3 py-2 text-xs font-semibold rounded-xl transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                        isExplorerActive 
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" 
                          : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/50"
                      }`}
                    >
                      <Database className="w-3.5 h-3.5" />
                      {isExplorerActive ? "Explorando" : "Explorar"}
                    </button>
                    <button
                      onClick={() => handleDisconnect(key)}
                      className="p-2 bg-red-950/30 hover:bg-red-900/20 text-red-400 border border-red-500/15 rounded-xl text-xs transition-colors cursor-pointer"
                      title="Desconectar Conta"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleConnect(key)}
                    className={`w-full py-2 px-3 text-xs font-semibold text-white rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5 ${provider.accentColor}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Conectar {provider.name}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Interactive File Explorer Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl" id="file-explorer-panel">
        
        {/* Explorer Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg">
              {providerDetails[activeExplorer]?.icon("w-4 h-4") || <Folder className="w-4 h-4" />}
            </span>
            <div>
              <h2 className="text-xs font-bold text-slate-100 font-sans">
                Explorador de Arquivos do {providerDetails[activeExplorer]?.name || "Provedor"}
              </h2>
              {currentProviderStatus?.connected ? (
                <p className="text-[10px] text-slate-400">
                  Navegando de forma sincronizada na conta <strong className="text-slate-300 font-mono">{currentProviderStatus?.email}</strong>
                </p>
              ) : (
                <p className="text-[10px] text-red-400">
                  Provedor selecionado não conectado. Conecte no cartão acima.
                </p>
              )}
            </div>
          </div>

          {/* Breadcrumbs */}
          {currentProviderStatus?.connected && (
            <div className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 border border-slate-800/60 rounded-xl max-w-full overflow-x-auto text-[11px]">
              <button
                onClick={() => handleBreadcrumbClick(-1)}
                className="text-indigo-400 hover:underline font-semibold cursor-pointer"
              >
                Raiz
              </button>
              
              {pathHistory.map((histPath, idx) => {
                const name = histPath.split("/").pop() || histPath;
                if (!name) return null;
                return (
                  <React.Fragment key={idx}>
                    <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
                    <button
                      onClick={() => handleBreadcrumbClick(idx)}
                      className="text-indigo-400 hover:underline font-semibold max-w-[100px] truncate cursor-pointer"
                    >
                      {name}
                    </button>
                  </React.Fragment>
                );
              })}

              {currentPath && (
                <>
                  <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
                  <span className="text-slate-200 font-semibold max-w-[120px] truncate">
                    {currentPath.split("/").pop()}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {currentProviderStatus?.connected ? (
          <div className="p-5 space-y-4">
            
            {/* Action Bar / Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between gap-3">
              
              {/* Search input */}
              <div className="relative flex-grow max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder={`Pesquisar arquivos e documentos no ${providerDetails[activeExplorer]?.name}...`}
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800/80 text-slate-100 placeholder-slate-500 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:border-indigo-500 transition-all font-medium"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleUploadFile}
                  className="hidden"
                />
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-md shadow-indigo-600/10"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Enviar Arquivo
                </button>

                <button
                  onClick={() => setIsFolderModalOpen(true)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                >
                  <Plus className="w-3.5 h-3.5 text-indigo-400" />
                  Nova Pasta
                </button>

                <button
                  onClick={() => setIsNewFileModalOpen(true)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  Nova Petição / Minuta
                </button>
              </div>

            </div>

            {/* Files Grid and Table Container */}
            <div className="border border-slate-800/60 rounded-xl bg-slate-950/40 overflow-hidden">
              {isLoadingFiles && items.length === 0 ? (
                <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                  <p className="text-xs font-semibold">Carregando conteúdo da nuvem...</p>
                </div>
              ) : items.length === 0 ? (
                <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                  <Folder className="w-10 h-10 text-slate-700" />
                  <p className="text-xs font-semibold">Nenhum arquivo ou pasta encontrado aqui.</p>
                  <p className="text-[10px] text-slate-600">Use os botões acima para enviar um arquivo ou criar pastas.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/80 text-[10px] uppercase tracking-wider font-bold text-slate-400">
                        <th className="px-5 py-3">Nome</th>
                        <th className="px-5 py-3">Tipo</th>
                        <th className="px-5 py-3">Tamanho</th>
                        <th className="px-5 py-3">Modificado em</th>
                        <th className="px-5 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-xs">
                      {/* Go back row */}
                      {pathHistory.length > 0 && !searchQuery && (
                        <tr
                          onClick={handleGoBack}
                          className="hover:bg-slate-800/25 cursor-pointer text-indigo-400 font-semibold transition-colors"
                        >
                          <td className="px-5 py-3 flex items-center gap-2" colSpan={5}>
                            <ArrowLeft className="w-4 h-4" />
                            <span>.. (Voltar para pasta anterior)</span>
                          </td>
                        </tr>
                      )}

                      {items.map((item, idx) => {
                        const isFolder = item[".tag"] === "folder";
                        return (
                          <tr
                            key={item.id || idx}
                            className="hover:bg-slate-800/20 transition-colors"
                          >
                            <td className="px-5 py-3">
                              <button
                                type="button"
                                onClick={() => isFolder ? handleFolderClick(item) : handleViewFile(item)}
                                className="flex items-center gap-2.5 text-slate-200 hover:text-indigo-400 font-semibold text-left truncate max-w-[320px] outline-none"
                              >
                                {isFolder ? (
                                  <Folder className="w-4 h-4 text-amber-500 fill-amber-500/10 flex-shrink-0" />
                                ) : (
                                  <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                )}
                                <span>{item.name}</span>
                              </button>
                            </td>
                            <td className="px-5 py-3 text-slate-400">
                              {isFolder ? "Pasta de Arquivos" : "Documento"}
                            </td>
                            <td className="px-5 py-3 text-slate-400 font-mono text-[11px]">
                              {isFolder ? "-" : formatBytes(item.size)}
                            </td>
                            <td className="px-5 py-3 text-slate-400">
                              {isFolder ? "-" : formatDate(item.client_modified)}
                            </td>
                            <td className="px-5 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {!isFolder ? (
                                  <>
                                    <button
                                      onClick={() => handleViewFile(item)}
                                      className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-400 transition-colors"
                                      title="Visualizar Documento"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                    
                                    <button
                                      onClick={() => setImportingFile(item)}
                                      className="px-2.5 py-1 bg-indigo-600/15 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/25 font-bold rounded-lg text-[10px] transition-all cursor-pointer"
                                      title="Importar para o ERP"
                                    >
                                      Importar ERP
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => handleFolderClick(item)}
                                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700/60 font-bold rounded-lg text-[10px] cursor-pointer transition-colors"
                                  >
                                    Abrir
                                  </button>
                                )}

                                {/* Context Action Buttons */}
                                <button
                                  onClick={() => {
                                    setRenamingItem(item);
                                    setRenameNewName(item.name);
                                  }}
                                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-indigo-400 transition-colors"
                                  title="Renomear"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => {
                                    setMovingItem(item);
                                    setMoveTargetPath("");
                                  }}
                                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-indigo-400 transition-colors"
                                  title="Mover"
                                >
                                  <Move className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => handleDeleteItem(item)}
                                  className="p-1.5 hover:bg-slate-850 rounded-lg text-slate-500 hover:text-red-400 transition-colors"
                                  title="Excluir"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Sandbox Notice */}
            {currentProviderStatus?.mockMode && (
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-[11px] text-slate-400 flex items-start gap-2.5">
                <HelpCircle className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-indigo-400">Modo de Demonstração (Sandbox):</span> Como as credenciais oficiais da API de produção não estão preenchidas no ambiente, ativamos um simulador totalmente funcional de arquivos em nuvem do {providerDetails[activeExplorer]?.name} para que você explore, crie pastas, faça upload e renomeie livremente.
                </div>
              </div>
            )}

          </div>
        ) : (
          <div className="py-20 text-center space-y-4">
            <div className="h-16 w-16 bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto text-slate-500 border border-slate-800">
              <Lock className="w-8 h-8 text-slate-600" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="text-sm font-bold text-slate-200">Explorador Bloqueado</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Acesse o painel superior e clique em <strong>Conectar {providerDetails[activeExplorer]?.name || "Provedor"}</strong> para liberar a visualização e gestão de seus arquivos jurídicos.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* --- MODALS SECTION --- */}

      {/* 1. IMPORT TO ERP MODAL */}
      {importingFile && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Cloud className="w-5 h-5 text-indigo-400 animate-bounce" />
              <div>
                <h3 className="text-sm font-bold text-slate-100 font-sans">Importar Arquivo para o ERP</h3>
                <p className="text-[10px] text-slate-400">Gere um registro rastreável do arquivo no painel de documentos do LegalOne</p>
              </div>
            </div>

            {importSuccess ? (
              <div className="py-6 text-center space-y-2">
                <div className="h-12 w-12 bg-emerald-600/15 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-xs font-bold text-slate-100">Documento Importado!</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  O arquivo da nuvem foi referenciado e salvo com sucesso no banco de dados do escritório.
                </p>
              </div>
            ) : (
              <form onSubmit={handleImportSubmit} className="space-y-4">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Documento Selecionado</p>
                  <p className="text-xs text-slate-200 font-bold truncate">{importingFile.name}</p>
                  <p className="text-[10px] text-slate-500">Tamanho total: {formatBytes(importingFile.size)}</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Categoria Jurídica</label>
                  <select
                    value={importCategory}
                    onChange={(e) => setImportCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500 font-medium"
                  >
                    <option value="Contrato">Contrato</option>
                    <option value="Petição">Petição</option>
                    <option value="Procuração">Procuração</option>
                    <option value="Laudo Pericial">Laudo Pericial</option>
                    <option value="Documento Pessoal">Documento Pessoal</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Vincular ao Cliente (Opcional)</label>
                  <select
                    value={importClientId}
                    onChange={(e) => setImportClientId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500 font-medium"
                  >
                    <option value="">-- Sem vínculo de cliente --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} {c.document ? `(${c.document})` : ""}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Vincular ao Processo CNJ (Opcional)</label>
                  <select
                    value={importProcessId}
                    onChange={(e) => setImportProcessId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500 font-medium"
                  >
                    <option value="">-- Sem vínculo de processo --</option>
                    {processes.map((p) => (
                      <option key={p.id} value={p.id}>{p.cnj} - {p.title}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setImportingFile(null)}
                    disabled={importing}
                    className="w-1/2 px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                  
                  <button
                    type="submit"
                    disabled={importing}
                    className="w-1/2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-md shadow-indigo-600/15"
                  >
                    {importing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Importando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Confirmar
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 2. CREATE FOLDER MODAL */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Folder className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-100">Criar Nova Pasta</h3>
            </div>

            <form onSubmit={handleCreateFolderSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400">Nome da Pasta</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Documentos de Prova - Carlos"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFolderModalOpen(false)}
                  className="w-1/2 px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingFolder}
                  className="w-1/2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center cursor-pointer transition-all"
                >
                  {isCreatingFolder ? "Criando..." : "Criar Pasta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. RENAME MODAL */}
      {renamingItem && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Edit3 className="w-5 h-5 text-indigo-400" />
              <h3 className="text-sm font-bold text-slate-100">Renomear Arquivo ou Pasta</h3>
            </div>

            <form onSubmit={handleRenameSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400">Novo Nome</label>
                <input
                  type="text"
                  required
                  value={renameNewName}
                  onChange={(e) => setRenameNewName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setRenamingItem(null)}
                  className="w-1/2 px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isRenaming}
                  className="w-1/2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center cursor-pointer transition-all"
                >
                  {isRenaming ? "Salvando..." : "Salvar Nome"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. MOVE MODAL */}
      {movingItem && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Move className="w-5 h-5 text-sky-400" />
              <h3 className="text-sm font-bold text-slate-100">Mover Item para Outro Diretório</h3>
            </div>

            <form onSubmit={handleMoveSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400">Item Selecionado</label>
                <p className="text-xs text-slate-300 font-semibold truncate bg-slate-950 px-3 py-2 border border-slate-800 rounded-xl">{movingItem.name}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400">Caminho / Pasta de Destino</label>
                <input
                  type="text"
                  placeholder="Ex: /Modelos de Petições Jurídicas"
                  value={moveTargetPath}
                  onChange={(e) => setMoveTargetPath(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-indigo-500 font-medium"
                />
                <span className="text-[9px] text-slate-500 block">Deixe vazio para mover para o diretório raiz (/)</span>
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setMovingItem(null)}
                  className="w-1/2 px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isMoving}
                  className="w-1/2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center cursor-pointer transition-all"
                >
                  {isMoving ? "Movendo..." : "Mover Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. NEW PETITION FILE MODAL */}
      {isNewFileModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <FileText className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="text-sm font-bold text-slate-100 font-sans">Gerar Minuta de Petição</h3>
                <p className="text-[10px] text-slate-400">Crie e salve uma nova minuta de petição diretamente em sua nuvem</p>
              </div>
            </div>

            <form onSubmit={handleCreateFileSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400">Nome do Arquivo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Peticao_Inicial_Danos_Morais"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400">Conteúdo Inicial do Documento</label>
                <textarea
                  placeholder="EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO..."
                  rows={8}
                  value={newFileContent}
                  onChange={(e) => setNewFileContent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl p-3 text-xs outline-none focus:border-indigo-500 font-medium font-mono"
                ></textarea>
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsNewFileModalOpen(false)}
                  className="w-1/2 px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingFile}
                  className="w-1/2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center cursor-pointer transition-all shadow-md"
                >
                  {isCreatingFile ? "Gerando..." : "Salvar na Nuvem"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
