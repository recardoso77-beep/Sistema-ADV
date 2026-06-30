import React, { useState, useEffect, useCallback } from "react";
import { Folder, FileText, Search, RefreshCw, LogOut, ArrowLeft, ExternalLink, Database, CheckCircle2, ChevronRight, AlertCircle, HelpCircle, File, Settings, Key, Lock, Cloud } from "lucide-react";
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

const providerDetails = {
  none: {
    name: "Sem Provedor",
    color: "slate",
    icon: (className = "w-5 h-5") => <Database className={className} />,
    description: "Nenhum provedor de armazenamento em nuvem (GED) está configurado para o escritório ativo.",
  },
  dropbox: {
    name: "Dropbox",
    color: "blue",
    icon: (className = "w-5 h-5") => (
      <svg className={`${className} fill-current text-blue-400`} viewBox="0 0 24 24">
        <path d="M5.962 3L1.05 6.13l3.968 3.178L12 4.931 5.962 3zM1.05 12.441l4.912 3.13 6.038-4.377-7.006-4.377-3.944 5.624zm10.95 2.181l5.962-4.377 3.968 3.13-7.006 4.377-2.924-3.13zm6.038-11.622L22.95 6.13 18.038 9.308 12 4.931l6.038-1.931zM12 11.194l7.006-4.377 3.944 5.624-4.912 3.13-6.038-4.377zm-4.376 6.309l4.376 2.454 4.376-2.454L12 15.34l-4.376 2.163z" />
      </svg>
    ),
    description: "Gerencie e integre suas petições, procurações e contratos armazenados na sua conta do Dropbox.",
  },
  gdrive: {
    name: "Google Drive",
    color: "emerald",
    icon: (className = "w-5 h-5") => (
      <svg className={`${className} fill-current text-emerald-400`} viewBox="0 0 24 24">
        <path d="M19.43 12.98l-6.73-11.66c-.37-.64-1.03-1.03-1.78-1.03h-1.84c-.75 0-1.41.39-1.78 1.03l-6.73 11.66c-.37.64-.37 1.42 0 2.06l1.84 3.18c.37.64 1.03 1.03 1.78 1.03h13.46c.75 0 1.41-.39 1.78-1.03l1.84-3.18c.37-.64.37-1.42 0-2.06zM11.5 4.5l5.5 9.5H6l5.5-9.5z" />
      </svg>
    ),
    description: "Sincronize petições jurídicas, contratos de clientes e documentos de prova salvos no seu Google Drive.",
  },
  onedrive: {
    name: "OneDrive",
    color: "sky",
    icon: (className = "w-5 h-5") => (
      <svg className={`${className} fill-current text-sky-400`} viewBox="0 0 24 24">
        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z" />
      </svg>
    ),
    description: "Gerencie e importe contratos e relatórios do Microsoft OneDrive da sua banca de advocacia.",
  }
};

export default function GedDropbox({ clients, processes, token, onRefresh }: GedDropboxProps) {
  const [provider, setProvider] = useState<"none" | "dropbox" | "gdrive" | "onedrive">("none");
  const [isConnected, setIsConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [mockMode, setMockMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Navigation & Search State
  const [currentPath, setCurrentPath] = useState<string>("");
  const [pathHistory, setPathHistory] = useState<string[]>([]);
  const [items, setItems] = useState<CloudItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Import Modal State
  const [importingFile, setImportingFile] = useState<CloudItem | null>(null);
  const [importCategory, setImportCategory] = useState("Contrato");
  const [importClientId, setImportClientId] = useState("");
  const [importProcessId, setImportProcessId] = useState("");
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);

  // Fetch items list
  const fetchItems = async (path: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cloud/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ path }),
      });

      if (!res.ok) {
        throw new Error("Erro ao obter arquivos em nuvem");
      }

      const data = await res.json();
      setItems(data.entries || []);
    } catch (err: any) {
      console.error("Error listing files:", err);
      setError("Erro ao carregar os documentos da nuvem.");
    } finally {
      setIsLoading(false);
    }
  };

  // Check Cloud connection status
  const checkStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cloud/status", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setProvider(data.provider);
        setIsConnected(data.connected);
        setConnectedEmail(data.email);
        setMockMode(data.mockMode);
        
        if (data.connected && data.provider !== "none") {
          fetchItems(currentPath);
        }
      }
    } catch (err: any) {
      console.error("Error checking cloud status:", err);
      setError("Não foi possível verificar a conexão com o provedor de nuvem.");
    } finally {
      setIsLoading(false);
    }
  }, [token, currentPath]);

  // Run Search
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      fetchItems(currentPath);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cloud/list?search=${encodeURIComponent(query)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ path: "" }),
      });

      if (res.ok) {
        const data = await res.json();
        setItems(data.entries || []);
      }
    } catch (err) {
      console.error("Search error:", err);
      setError("Erro ao pesquisar arquivos na nuvem.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, [token]);

  // Handle message from OAuth popup
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === "CLOUD_AUTH_SUCCESS" || event.data?.type === "DROPBOX_AUTH_SUCCESS") {
        checkStatus();
      }
    };
    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, [checkStatus]);

  // Connect Cloud (opens popup)
  const handleConnect = async () => {
    setError(null);
    try {
      const res = await fetch("/api/cloud/auth-url", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Não foi possível gerar a URL de autenticação.");
      }

      const { url } = await res.json();
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const authWindow = window.open(
        url,
        "cloud_oauth_popup",
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
      );

      if (!authWindow) {
        alert("O bloqueador de popups impediu a janela de login. Por favor, autorize popups para este site.");
      }
    } catch (err: any) {
      setError(err.message || "Erro ao conectar ao provedor de nuvem.");
    }
  };

  // Disconnect Cloud
  const handleDisconnect = async () => {
    if (!window.confirm(`Deseja realmente desconectar sua conta do ${providerDetails[provider]?.name || "provedor"}?`)) return;
    setError(null);
    try {
      const res = await fetch("/api/cloud/disconnect", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        setIsConnected(false);
        setConnectedEmail(null);
        setItems([]);
        setCurrentPath("");
        setPathHistory([]);
      }
    } catch (err) {
      setError("Erro ao desconectar do provedor de nuvem.");
    }
  };

  // Folder navigation helpers
  const handleFolderClick = (folder: CloudItem) => {
    const newPath = folder.path_display;
    setPathHistory((prev) => [...prev, currentPath]);
    setCurrentPath(newPath);
    setSearchQuery("");
    fetchItems(newPath);
  };

  const handleGoBack = () => {
    if (pathHistory.length === 0) return;
    const previous = pathHistory[pathHistory.length - 1];
    setPathHistory((prev) => prev.slice(0, -1));
    setCurrentPath(previous);
    setSearchQuery("");
    fetchItems(previous);
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      setCurrentPath("");
      setPathHistory([]);
      setSearchQuery("");
      fetchItems("");
      return;
    }
    const newHistory = pathHistory.slice(0, index + 1);
    const targetPath = pathHistory[index];
    setPathHistory(newHistory.slice(0, -1));
    setCurrentPath(targetPath);
    setSearchQuery("");
    fetchItems(targetPath);
  };

  // View File
  const handleViewFile = async (file: CloudItem) => {
    setError(null);
    try {
      const res = await fetch("/api/cloud/get-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ path: file.path_display }),
      });

      if (!res.ok) {
        throw new Error("Não foi possível gerar o link de visualização.");
      }

      const data = await res.json();
      window.open(data.link, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      setError("Erro ao visualizar o arquivo.");
    }
  };

  // Import to ERP (Create doc)
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
        body: JSON.stringify({ path: importingFile.path_display }),
      });

      if (!linkRes.ok) {
        throw new Error("Erro ao obter link seguro do documento.");
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
      onRefresh(); // Refresh documents in app
      
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

  const formatBytes = (bytes?: number) => {
    if (!bytes) return "N/A";
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

  const currentDetails = providerDetails[provider] || providerDetails.none;

  return (
    <div className="space-y-6" id="ged-cloud-tab">
      {/* Title Header Block */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-slate-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-600/10 text-indigo-400 rounded-xl">
              <Cloud className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-100">GED - Gestão Eletrônica de Documentos</h1>
          </div>
          <p className="text-xs text-slate-400">
            Acesse seus documentos jurídicos salvos em nuvem de forma integrada e segura.
          </p>
        </div>

        {isConnected && provider !== "none" && (
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-red-950/40 hover:bg-red-900/30 text-red-400 border border-red-500/20 rounded-xl text-xs font-semibold cursor-pointer transition-all"
          >
            <LogOut className="w-3.5 h-3.5" /> Desconectar {currentDetails.name}
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-950/30 border border-red-500/20 text-red-300 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. NOT CONFIGURED (NONE) STATE */}
      {provider === "none" ? (
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-12 text-center max-w-2xl mx-auto space-y-6 relative" id="ged-no-provider">
          <div className="absolute right-1/4 top-1/4 w-32 h-32 bg-slate-500/5 rounded-full blur-2xl pointer-events-none"></div>
          
          <div className="h-16 w-16 mx-auto bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 border border-slate-700/60">
            <Database className="w-9 h-9" />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-slate-100">Nenhum Provedor de GED Configurado</h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              Este escritório ainda não possui um provedor de armazenamento em nuvem configurado para gerenciar arquivos.
            </p>
          </div>

          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl text-left text-xs text-slate-300 max-w-lg mx-auto space-y-3">
            <span className="font-semibold text-slate-200 block">Como o Administrador pode ativar?</span>
            <div className="text-[11px] text-slate-400 space-y-1.5 leading-relaxed">
              <p>1. Acesse o <strong className="text-slate-300">Painel Administrativo</strong> no menu lateral.</p>
              <p>2. Vá até a aba <strong className="text-slate-300">Escritórios</strong>.</p>
              <p>3. Clique em <strong className="text-slate-300">Editar</strong> no escritório correspondente.</p>
              <p>4. No campo Provedor de Nuvem, selecione <strong className="text-indigo-400">Dropbox</strong>, <strong className="text-emerald-400">Google Drive</strong> ou <strong className="text-sky-400">OneDrive</strong> e insira as credenciais da API.</p>
            </div>
          </div>
        </div>
      ) : (
        /* 2. PROVIDER IS CONFIGURED STATE */
        <>
          {!isConnected ? (
            /* CONFIGURED BUT NOT CONNECTED STATE */
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-12 text-center max-w-2xl mx-auto space-y-6 relative">
              <div className="absolute right-1/4 top-1/4 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="h-16 w-16 mx-auto bg-slate-800 rounded-2xl flex items-center justify-center border border-slate-700">
                {currentDetails.icon("w-9 h-9")}
              </div>

              <div className="space-y-2">
                <h2 className="text-lg font-bold text-slate-100">Vincular Conta do {currentDetails.name}</h2>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  {currentDetails.description} Conecte a conta do escritório para liberar o acesso aos arquivos.
                </p>
              </div>

              <button
                onClick={handleConnect}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs transition-colors shadow-lg shadow-indigo-600/10 inline-flex items-center gap-2 cursor-pointer"
              >
                {currentDetails.icon("w-4 h-4 text-white")}
                Vincular Conta do {currentDetails.name}
              </button>

              {mockMode && (
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-[11px] text-slate-400 max-w-lg mx-auto leading-relaxed flex items-start gap-2 text-left">
                  <HelpCircle className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-indigo-400">Modo de Demonstração Ativo:</span> Como não há chaves de API personalizadas salvas pelo administrador para este escritório, utilizaremos o modo de simulação funcional para que você possa testar a navegação, abertura de PDFs e importação.
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* CONNECTED STATE */
            <div className="space-y-4">
              {/* Status Header */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  {currentDetails.icon("w-4 h-4")}
                  <p className="text-xs text-slate-300">
                    Conectado ao <span className="font-bold text-slate-100">{currentDetails.name}</span>: <span className="font-semibold text-slate-400">{connectedEmail}</span>
                  </p>
                  {mockMode && (
                    <span className="text-[9px] font-semibold bg-indigo-950/60 text-indigo-300 border border-indigo-800 px-1.5 py-0.5 rounded-md">
                      Sandbox
                    </span>
                  )}
                </div>

                {/* Breadcrumbs */}
                <div className="flex items-center gap-1.5 text-xs text-slate-400 overflow-x-auto py-1">
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
                        <ChevronRight className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                        <button
                          onClick={() => handleBreadcrumbClick(idx)}
                          className="text-indigo-400 hover:underline font-semibold max-w-[120px] truncate cursor-pointer"
                        >
                          {name}
                        </button>
                      </React.Fragment>
                    );
                  })}

                  {currentPath && (
                    <>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                      <span className="text-slate-100 font-semibold max-w-[150px] truncate">
                        {currentPath.split("/").pop()}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-grow">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder={`Pesquisar arquivos no ${currentDetails.name}...`}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      handleSearch(e.target.value);
                    }}
                    className="w-full bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none focus:border-indigo-500 transition-all font-medium"
                  />
                </div>
                
                <button
                  onClick={() => {
                    setSearchQuery("");
                    fetchItems(currentPath);
                  }}
                  disabled={isLoading}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                  Sincronizar
                </button>
              </div>

              {/* Items List */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                {isLoading && items.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                    <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                    <p className="text-xs font-semibold">Carregando seus arquivos...</p>
                  </div>
                ) : items.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                    <Folder className="w-10 h-10 text-slate-700" />
                    <p className="text-xs font-semibold">Nenhum arquivo ou pasta localizado aqui.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950/40 text-[10px] uppercase tracking-wider font-bold text-slate-400">
                          <th className="px-5 py-3">Nome</th>
                          <th className="px-5 py-3">Tipo</th>
                          <th className="px-5 py-3">Tamanho</th>
                          <th className="px-5 py-3">Última Modificação</th>
                          <th className="px-5 py-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-xs">
                        {/* Go back row */}
                        {pathHistory.length > 0 && !searchQuery && (
                          <tr
                            onClick={handleGoBack}
                            className="hover:bg-slate-800/40 cursor-pointer text-indigo-400 font-semibold"
                          >
                            <td className="px-5 py-3.5 flex items-center gap-2">
                              <ArrowLeft className="w-4 h-4" />
                              <span>.. (Voltar pasta anterior)</span>
                            </td>
                            <td className="px-5 py-3.5">-</td>
                            <td className="px-5 py-3.5">-</td>
                            <td className="px-5 py-3.5">-</td>
                            <td className="px-5 py-3.5 text-right">-</td>
                          </tr>
                        )}

                        {items.map((item, idx) => {
                          const isFolder = item[".tag"] === "folder";
                          return (
                            <tr
                              key={idx}
                              className="hover:bg-slate-800/30 transition-colors"
                            >
                              <td className="px-5 py-3.5">
                                <button
                                  type="button"
                                  onClick={() => isFolder ? handleFolderClick(item) : handleViewFile(item)}
                                  className="flex items-center gap-2.5 text-slate-100 hover:text-indigo-400 font-semibold text-left truncate max-w-[320px] outline-none"
                                >
                                  {isFolder ? (
                                    <Folder className="w-4 h-4 text-amber-500 fill-amber-500/10 flex-shrink-0" />
                                  ) : (
                                    <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                  )}
                                  <span>{item.name}</span>
                                </button>
                              </td>
                              <td className="px-5 py-3.5 text-slate-400">
                                {isFolder ? "Pasta" : "Arquivo"}
                              </td>
                              <td className="px-5 py-3.5 text-slate-400">
                                {isFolder ? "-" : formatBytes(item.size)}
                              </td>
                              <td className="px-5 py-3.5 text-slate-400">
                                {isFolder ? "-" : formatDate(item.client_modified)}
                              </td>
                              <td className="px-5 py-3.5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {!isFolder && (
                                    <>
                                      <button
                                        onClick={() => handleViewFile(item)}
                                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-400 transition-colors"
                                        title="Visualizar Arquivo"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => setImportingFile(item)}
                                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-[10px] transition-colors cursor-pointer"
                                      >
                                        Importar ERP
                                      </button>
                                    </>
                                  )}
                                  {isFolder && (
                                    <button
                                      onClick={() => handleFolderClick(item)}
                                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/50 font-bold rounded-lg text-[10px] cursor-pointer"
                                    >
                                      Abrir
                                    </button>
                                  )}
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
            </div>
          )}
        </>
      )}

      {/* 3. IMPORT TO ERP MODAL */}
      {importingFile && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Cloud className="w-5 h-5 text-indigo-400" />
              <div>
                <h3 className="text-sm font-bold text-slate-100">Importar Arquivo para o ERP</h3>
                <p className="text-[10px] text-slate-400">Vincule este arquivo a um cliente ou processo no LegalOne</p>
              </div>
            </div>

            {importSuccess ? (
              <div className="py-6 text-center space-y-2">
                <div className="h-12 w-12 bg-emerald-600/15 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-xs font-bold text-slate-100">Documento Importado!</h4>
                <p className="text-[11px] text-slate-400">O arquivo foi salvo com sucesso e já está disponível na lista de documentos protegidos do ERP.</p>
              </div>
            ) : (
              <form onSubmit={handleImportSubmit} className="space-y-4">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Documento Selecionado</p>
                  <p className="text-xs text-slate-200 font-bold truncate">{importingFile.name}</p>
                  <p className="text-[10px] text-slate-500">Tamanho: {formatBytes(importingFile.size)}</p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Categoria do Documento</label>
                  <select
                    value={importCategory}
                    onChange={(e) => setImportCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500"
                  >
                    <option value="Contrato">Contrato</option>
                    <option value="Petição">Petição</option>
                    <option value="Procuração">Procuração</option>
                    <option value="Laudo Pericial">Laudo Pericial</option>
                    <option value="Documento Pessoal">Documento Pessoal</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Vincular a um Cliente (Opcional)</label>
                  <select
                    value={importClientId}
                    onChange={(e) => setImportClientId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500"
                  >
                    <option value="">Nenhum Cliente Selecionado</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} {c.document ? `(${c.document})` : ""}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Vincular a um Processo (Opcional)</label>
                  <select
                    value={importProcessId}
                    onChange={(e) => setImportProcessId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500"
                  >
                    <option value="">Nenhum Processo Selecionado</option>
                    {processes.map((p) => (
                      <option key={p.id} value={p.id}>{p.cnj} - {p.title}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2 pt-2">
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
                    className="w-1/2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                  >
                    {importing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Importando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Concluir Importação
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
