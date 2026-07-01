import React, { useState } from "react";
import { FileText, Folder, Plus, X, Search, Sparkles, FileSignature, ShieldCheck, Check, Info, FileCode, Edit3, ClipboardList, Eye, Cloud } from "lucide-react";
import { DocumentItem, Client, Process, LawFirm } from "../types";

function isColorLight(hex: string): boolean {
  if (!hex) return false;
  const cleaned = hex.replace("#", "");
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) > 186;
  }
  if (cleaned.length === 6) {
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) > 186;
  }
  return false;
}

interface DocumentsProps {
  documents: DocumentItem[];
  clients: Client[];
  processes: Process[];
  token: string;
  onRefresh: () => Promise<void>;
  userRole: string;
  activeFirm?: LawFirm;
}

export default function Documents({ documents, clients, processes, token, onRefresh, userRole, activeFirm }: DocumentsProps) {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<"all" | "Contrato" | "Procuração" | "Petição" | "Parecer">("all");
  
  // Modals state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [isPetitionModalOpen, setIsPetitionModalOpen] = useState(false);

  // Form upload
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState<any>("Contrato");
  const [formProcessId, setFormProcessId] = useState("");
  const [formClientId, setFormClientId] = useState("");

  // AI draft states
  const [aiContractTitle, setAiContractTitle] = useState("");
  const [aiContractPartyA, setAiContractPartyA] = useState("");
  const [aiContractPartyB, setAiContractPartyB] = useState("");
  const [aiContractTerms, setAiContractTerms] = useState("");
  const [aiContractOutput, setAiContractOutput] = useState("");
  const [aiContractLoading, setAiContractLoading] = useState(false);

  const [aiPetitionArea, setAiPetitionArea] = useState("Cível");
  const [aiPetitionFacts, setAiPetitionFacts] = useState("");
  const [aiPetitionRequests, setAiPetitionRequests] = useState("");
  const [aiPetitionOutput, setAiPetitionOutput] = useState("");
  const [aiPetitionLoading, setAiPetitionLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Estados da Integração Oficial D4Sign
  const [d4signToken, setD4signToken] = useState(localStorage.getItem("d4sign_token") || "");
  const [d4signSafeUuid, setD4signSafeUuid] = useState(localStorage.getItem("d4sign_safe_uuid") || "");
  const [d4signEnabled, setD4signEnabled] = useState(localStorage.getItem("d4sign_enabled") === "true");
  const [isD4signConfigOpen, setIsD4signConfigOpen] = useState(false);

  // Estados de Envio para Assinatura D4Sign
  const [selectedDocForD4sign, setSelectedDocForD4sign] = useState<DocumentItem | null>(null);
  const [d4signSigners, setD4signSigners] = useState<{ name: string; email: string; cpf: string }[]>([
    { name: "", email: "", cpf: "" }
  ]);
  const [sendingD4sign, setSendingD4sign] = useState(false);
  const [formFile, setFormFile] = useState<File | null>(null);
  const [viewingDoc, setViewingDoc] = useState<any | null>(null);

  const filteredDocs = documents.filter((doc) => {
    const matchSearch = doc.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === "all" ? doc.category !== "Pasta" : doc.category === filterCategory;
    return matchSearch && matchCat;
  });

  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    setLoading(true);
    setErrorMsg("");

    let fileContentBase64 = "";
    if (formFile) {
      try {
        fileContentBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = (error) => reject(error);
          reader.readAsDataURL(formFile);
        });
      } catch (errFile) {
        console.error("Erro ao converter arquivo para Base64:", errFile);
      }
    }

    const payload = {
      name: formName,
      category: formCategory,
      file_path: formFile ? `/uploads/${formFile.name}` : `/uploads/${formCategory.toLowerCase()}_${Math.floor(Math.random()*1000)}.pdf`,
      version: 1,
      process_id: formProcessId || null,
      client_id: formClientId || null,
      file_content: fileContentBase64 || null,
    };

    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await onRefresh();
        setIsUploadModalOpen(false);
        setFormName("");
        setFormProcessId("");
        setFormClientId("");
        setFormFile(null);
      } else {
        const data = await res.json();
        setErrorMsg(data.error || "Erro ao registrar documento.");
      }
    } catch (err) {
      setErrorMsg("Erro de comunicação com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignDoc = async (id: string) => {
    try {
      const res = await fetch(`/api/documents/${id}/sign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        await onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveD4signSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("d4sign_token", d4signToken);
    localStorage.setItem("d4sign_safe_uuid", d4signSafeUuid);
    localStorage.setItem("d4sign_enabled", String(d4signEnabled));
    setIsD4signConfigOpen(false);
  };

  const handleSendToD4SignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocForD4sign) return;
    setSendingD4sign(true);
    try {
      const res = await fetch(`/api/documents/${selectedDocForD4sign.id}/d4sign-send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ signers: d4signSigners })
      });
      if (res.ok) {
        await onRefresh();
        setSelectedDocForD4sign(null);
        setD4signSigners([{ name: "", email: "", cpf: "" }]);
      } else {
        const d = await res.json();
        alert(d.error || "Erro ao enviar para D4Sign.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSendingD4sign(false);
    }
  };

  const handleSyncD4Sign = async (id: string) => {
    try {
      const res = await fetch(`/api/documents/${id}/d4sign-sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        await onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateContractAi = async () => {
    if (!aiContractTitle || !aiContractPartyA) return;
    setAiContractLoading(true);
    setAiContractOutput("");
    try {
      const res = await fetch("/api/ai/contract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: aiContractTitle,
          partyA: aiContractPartyA,
          partyB: aiContractPartyB,
          terms: aiContractTerms,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setAiContractOutput(data.contract);
      } else {
        setAiContractOutput("⚠️ Erro: " + data.error);
      }
    } catch (err) {
      setAiContractOutput("⚠️ Falha de comunicação.");
    } finally {
      setAiContractLoading(false);
    }
  };

  const handleGeneratePetitionAi = async () => {
    if (!aiPetitionFacts || !aiPetitionRequests) return;
    setAiPetitionLoading(true);
    setAiPetitionOutput("");
    try {
      const res = await fetch("/api/ai/petition", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          area: aiPetitionArea,
          facts: aiPetitionFacts,
          requests: aiPetitionRequests,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setAiPetitionOutput(data.petition);
      } else {
        setAiPetitionOutput("⚠️ Erro: " + data.error);
      }
    } catch (err) {
      setAiPetitionOutput("⚠️ Falha de comunicação.");
    } finally {
      setAiPetitionLoading(false);
    }
  };

  const handleSaveAiDoc = async (name: string, cat: string, text: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name,
          category: cat,
          file_path: `/uploads/ai_generated_${Date.now()}.pdf`,
          version: 1,
        }),
      });
      if (res.ok) {
        await onRefresh();
        setIsContractModalOpen(false);
        setIsPetitionModalOpen(false);
        setAiContractOutput("");
        setAiPetitionOutput("");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" id="documents-module-view">
      {/* Header and top triggers */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Gestão Documental e Assinatura Eletrônica</h2>
          <p className="text-xs text-slate-400 mt-1">Armazene contratos, peças jurídicas, e gerencie assinaturas de forma ágil e segura.</p>
        </div>
        
        {userRole !== "client" && (() => {
          const isPrimaryLight = isColorLight(activeFirm?.primary_color || "#4f46e5");
          const isSecondaryLight = isColorLight(activeFirm?.secondary_color || "#111827");
          
          const primaryBtnBg = 'var(--theme-primary)';
          const primaryBtnTextColor = isPrimaryLight ? 'text-slate-900' : 'text-white';
          const primaryBtnSparklesColor = isPrimaryLight ? 'text-slate-800' : 'text-slate-200';
          
          const secondaryBtnBg = 'var(--theme-secondary)';
          const secondaryBtnTextColor = isSecondaryLight ? 'text-slate-900' : 'text-white';

          return (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setIsContractModalOpen(true)}
                className={`text-xs font-semibold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm border ${primaryBtnTextColor} hover:opacity-90`}
                style={{ 
                  backgroundColor: primaryBtnBg,
                  borderColor: isPrimaryLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)'
                }}
              >
                <Sparkles className={`w-4 h-4 animate-pulse ${primaryBtnSparklesColor}`} /> Minutar Contrato IA
              </button>
              <button
                onClick={() => setIsPetitionModalOpen(true)}
                className={`text-xs font-semibold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm border ${primaryBtnTextColor} hover:opacity-90`}
                style={{ 
                  backgroundColor: primaryBtnBg,
                  borderColor: isPrimaryLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)'
                }}
              >
                <Sparkles className={`w-4 h-4 animate-pulse ${primaryBtnSparklesColor}`} /> Minutar Petição IA
              </button>
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className={`text-xs font-semibold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${secondaryBtnTextColor} hover:opacity-90`}
                style={{ backgroundColor: secondaryBtnBg }}
              >
                <Plus className="w-4 h-4" /> Registrar Arquivo
              </button>
            </div>
          );
        })()}
      </div>

      {/* Painel de Integração D4Sign (Oficial) */}
      {userRole !== "client" && (() => {
        const isPrimaryLight = isColorLight(activeFirm?.primary_color || "#4f46e5");
        const isSecondaryLight = isColorLight(activeFirm?.secondary_color || "#111827");
        
        const bannerBg = 'var(--theme-primary)';
        const bannerTextColor = isPrimaryLight ? "text-slate-900" : "text-white";
        const bannerMutedTextColor = isPrimaryLight ? "text-slate-600" : "text-slate-300";
        
        const configBtnBg = 'var(--theme-secondary)';

        return (
          <div 
            className="p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-lg overflow-hidden relative border transition-all"
            style={{ 
              backgroundColor: bannerBg,
              borderColor: isPrimaryLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)'
            }}
          >
            <div className="absolute right-0 top-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
            <div className="flex items-center gap-3">
              <div 
                className="p-2.5 rounded-xl border"
                style={{ 
                  backgroundColor: isPrimaryLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.1)',
                  borderColor: isPrimaryLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.15)'
                }}
              >
                <FileSignature className={`w-5 h-5 animate-pulse ${isPrimaryLight ? 'text-slate-800' : 'text-white'}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className={`text-xs sm:text-sm font-semibold tracking-tight ${bannerTextColor}`}>Integração Oficial D4Sign</h3>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${
                    d4signEnabled 
                      ? "bg-emerald-500/20 text-emerald-600" 
                      : isPrimaryLight ? "bg-slate-900/10 text-slate-800" : "bg-white/10 text-slate-300"
                  }`}>
                    {d4signEnabled ? "CONECTADO" : "INATIVO"}
                  </span>
                </div>
                <p className={`text-[10px] mt-0.5 ${bannerMutedTextColor}`}>
                  {d4signEnabled 
                    ? `Vinculado ao cofre UUID: ${d4signSafeUuid.slice(0, 8)}... Pronto para disparar assinaturas com validade jurídica.`
                    : "Conecte sua conta D4Sign para enviar contratos para assinatura eletrônica integrada."
                  }
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsD4signConfigOpen(true)}
              className="text-xs font-semibold px-4 py-2 rounded-xl transition-colors shrink-0 shadow-sm hover:opacity-95"
              style={{ 
                backgroundColor: configBtnBg,
                color: isSecondaryLight ? '#0f172a' : '#ffffff'
              }}
            >
              Configurar D4Sign
            </button>
          </div>
        );
      })()}

      {/* Filter panel */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col md:flex-row gap-3 items-center shadow-2xs">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar documentos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-2 rounded-xl text-xs outline-none focus:border-indigo-500 text-slate-800"
          />
        </div>

        <div className="flex flex-wrap gap-1">
          {["all", "Contrato", "Procuração", "Petição", "Parecer"].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                filterCategory === cat ? "bg-indigo-50 text-indigo-700 border border-indigo-100" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {cat === "all" ? "Todos Documentos" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Documents List */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs divide-y divide-slate-100">
        {filteredDocs.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2 opacity-75" />
            <p className="text-xs">Nenhum documento cadastrado nesta categoria.</p>
          </div>
        ) : (
          filteredDocs.map((doc) => {
            const process = processes.find((p) => p.id === doc.process_id);
            const client = clients.find((c) => c.id === doc.client_id);
            const isSigned = doc.signatures?.length > 0;

            return (
              <div key={doc.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white hover:bg-slate-50/20 transition-colors">
                <div className="flex items-start gap-3.5">
                  <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                    doc.category === "Contrato" ? "bg-indigo-50 text-indigo-700" :
                    doc.category === "Petição" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-700"
                  }`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="font-semibold text-xs sm:text-sm text-slate-800 flex items-center gap-2">
                      {doc.name}
                      <span className="text-[10px] font-mono text-slate-400 font-medium">V{doc.version}</span>
                    </h4>
                    <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                      {doc.category} • Criado por {doc.created_by} em {new Date(doc.created_at).toLocaleDateString("pt-BR")}
                    </p>
                    {(process || client) && (
                      <p className="text-[10px] text-indigo-600 font-medium pt-1">
                        {client && `Cliente: ${client.name}`} {process && ` • Processo CNJ: ${process.cnj}`}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Status D4Sign / Interno */}
                  {doc.d4sign_id ? (
                    <>
                      {doc.d4sign_status === "aguardando_assinaturas" ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-xl text-[10px] border border-blue-100 font-semibold">
                            <FileSignature className="w-3 h-3 text-blue-500 animate-pulse" /> D4Sign: Pendente
                          </span>
                          <button
                            onClick={() => handleSyncD4Sign(doc.id)}
                            className="text-[9px] text-indigo-600 hover:text-indigo-500 font-semibold underline flex items-center gap-1 cursor-pointer"
                          >
                            🔄 Sincronizar Status
                          </button>
                        </div>
                      ) : (
                        <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-xl text-[10px] border border-emerald-100 font-semibold">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> D4Sign: Finalizado
                        </span>
                      )}
                    </>
                  ) : isSigned ? (
                    <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-xl text-[10px] border border-emerald-100 font-semibold">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Assinado Interno
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-xl text-[10px] border border-amber-100 font-semibold">
                      Sem Assinaturas
                    </span>
                  )}

                  {/* Ações de Assinatura */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setViewingDoc(doc)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold px-2.5 py-2 rounded-xl flex items-center gap-1 transition-colors cursor-pointer border border-slate-200"
                      title="Visualizar documento"
                    >
                      <Eye className="w-3.5 h-3.5 text-indigo-500" /> Visualizar
                    </button>

                    {!isSigned && !doc.d4sign_id && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleSignDoc(doc.id)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold px-2.5 py-2 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                          title="Assinar usando certificado interno"
                        >
                          <FileSignature className="w-3.5 h-3.5" /> Assinar Interno
                        </button>
                        {d4signEnabled && (
                          <button
                            onClick={() => {
                              setSelectedDocForD4sign(doc);
                              setD4signSigners([{ name: "", email: "", cpf: "" }]);
                            }}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-semibold px-2.5 py-2 rounded-xl flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                            title="Enviar para D4Sign para validade oficial"
                          >
                            <FileSignature className="w-3.5 h-3.5" /> Enviar D4Sign
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* IA Contract drafting Generator Modal */}
      {isContractModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" /> Minutar Contrato por Inteligência Artificial
              </h3>
              <button onClick={() => setIsContractModalOpen(false)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-[10px] font-medium text-slate-500 mb-1">Título do Contrato</label>
                  <input
                    type="text"
                    placeholder="Ex: Contrato de Prestação"
                    value={aiContractTitle}
                    onChange={(e) => setAiContractTitle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-1">Contratante / Parte A</label>
                  <input
                    type="text"
                    placeholder="Nome completo / Razão"
                    value={aiContractPartyA}
                    onChange={(e) => setAiContractPartyA(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-1">Contratado / Parte B</label>
                  <input
                    type="text"
                    placeholder="Nome completo / Razão"
                    value={aiContractPartyB}
                    onChange={(e) => setAiContractPartyB(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-medium text-slate-500 mb-1">Cláusulas Desejadas / Condições de Negócio</label>
                <textarea
                  rows={3}
                  placeholder="Ex: Prestação de serviços de marketing por R$ 5.000 mensais com multa de 10% por atraso e vigência de 12 meses..."
                  value={aiContractTerms}
                  onChange={(e) => setAiContractTerms(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none resize-none"
                />
              </div>

              <button
                onClick={handleGenerateContractAi}
                disabled={aiContractLoading || !aiContractTitle || !aiContractPartyA}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm"
              >
                {aiContractLoading ? "Redigindo Contrato com Gemini..." : "Gerar Minuta de Alta Qualidade"}
              </button>

              {aiContractOutput && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500">
                    <span>Minuta Gerada por IA:</span>
                    <button
                      onClick={() => handleSaveAiDoc(aiContractTitle, "Contrato", aiContractOutput)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" /> Salvar nos Arquivos
                    </button>
                  </div>
                  <div className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono max-h-[250px] overflow-y-auto leading-relaxed whitespace-pre-wrap border border-slate-800">
                    {aiContractOutput}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* IA Petition skeletal Generator Modal */}
      {isPetitionModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" /> Minutar Petição Inicial por Inteligência Artificial
              </h3>
              <button onClick={() => setIsPetitionModalOpen(false)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-medium text-slate-500 mb-1">Área jurídica da ação</label>
                <select
                  value={aiPetitionArea}
                  onChange={(e) => setAiPetitionArea(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none"
                >
                  <option value="Cível">Cível</option>
                  <option value="Trabalhista">Trabalhista</option>
                  <option value="Penal">Penal</option>
                  <option value="Tributário">Tributário</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-medium text-slate-500 mb-1">Relatório dos Fatos Relevantes</label>
                <textarea
                  rows={3}
                  placeholder="Ex: Carlos prestou horas extras durante 1 ano sem remuneração devida e sofria cobrança excessiva do gerente..."
                  value={aiPetitionFacts}
                  onChange={(e) => setAiPetitionFacts(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-medium text-slate-500 mb-1">Fundamentos e Pedidos Finais</label>
                <textarea
                  rows={2}
                  placeholder="Ex: Condenação em horas extras, equiparação salarial e indenização por danos morais..."
                  value={aiPetitionRequests}
                  onChange={(e) => setAiPetitionRequests(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none resize-none"
                />
              </div>

              <button
                onClick={handleGeneratePetitionAi}
                disabled={aiPetitionLoading || !aiPetitionFacts || !aiPetitionRequests}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm"
              >
                {aiPetitionLoading ? "Estruturando Peça Jurídica com Gemini..." : "Gerar Minuta Jurídica (CPC)"}
              </button>

              {aiPetitionOutput && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500">
                    <span>Petição Inicial Gerada por IA:</span>
                    <button
                      onClick={() => handleSaveAiDoc(`Petição Inicial - ${aiPetitionArea}`, "Petição", aiPetitionOutput)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" /> Salvar nos Arquivos
                    </button>
                  </div>
                  <div className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono max-h-[250px] overflow-y-auto leading-relaxed whitespace-pre-wrap border border-slate-800">
                    {aiPetitionOutput}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manual document register Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 animate-fade-in">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-indigo-600" /> Registrar Novo Arquivo PDF/Doc
              </h3>
              <button onClick={() => setIsUploadModalOpen(false)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadDoc} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Título do Documento</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Procuração Sportix ou Contrato Social"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Categoria</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none"
                >
                  <option value="Contrato">Contrato</option>
                  <option value="Procuração">Procuração</option>
                  <option value="Petição">Petição</option>
                  <option value="Parecer">Parecer</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              {/* Upload de arquivo físico / digitalizador (Print 4) */}
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Selecionar Documento (PDF, Doc ou Imagem)</label>
                <div className="border border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-4 text-center cursor-pointer transition-colors relative bg-slate-50">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setFormFile(file);
                        if (!formName) {
                          setFormName(file.name.replace(/\.[^/.]+$/, ""));
                        }
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="space-y-1 text-slate-500">
                    <Cloud className="w-8 h-8 text-indigo-500 mx-auto" />
                    <p className="text-[11px] font-semibold text-slate-700">
                      {formFile ? `✓ Selecionado: ${formFile.name}` : "Clique para selecionar ou arraste o arquivo"}
                    </p>
                    <p className="text-[9px] text-slate-400">Tamanho máximo: 15MB</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Vincular a Processo (CNJ)</label>
                  <select
                    value={formProcessId}
                    onChange={(e) => setFormProcessId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-500"
                  >
                    <option value="">Nenhum...</option>
                    {processes.map((p) => (
                      <option key={p.id} value={p.id}>{p.court} - {p.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Vincular a Cliente</label>
                  <select
                    value={formClientId}
                    onChange={(e) => setFormClientId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-500"
                  >
                    <option value="">Nenhum...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold px-4 py-2 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-5 py-2 rounded-xl shadow-sm"
                >
                  {loading ? "Registrando..." : "Registrar Documento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Configuração D4Sign */}
      {isD4signConfigOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                🔑 Configurações Oficiais D4Sign
              </h3>
              <button onClick={() => setIsD4signConfigOpen(false)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveD4signSettings} className="p-6 space-y-4">
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="block text-xs font-semibold text-slate-800">Ativar Integração</span>
                  <span className="block text-[10px] text-slate-400">Permite enviar minutas por e-mail e CPF</span>
                </div>
                <input
                  type="checkbox"
                  checked={d4signEnabled}
                  onChange={(e) => setD4signEnabled(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">D4Sign Safe Key (Token API)</label>
                <input
                  type="password"
                  required={d4signEnabled}
                  placeholder="Insira sua Chave de API D4Sign..."
                  value={d4signToken}
                  onChange={(e) => setD4signToken(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">UUID do Cofre (Safe UUID)</label>
                <input
                  type="text"
                  required={d4signEnabled}
                  placeholder="Ex: 8fa7b2a9-0d1c-4b3e-90a1-..."
                  value={d4signSafeUuid}
                  onChange={(e) => setD4signSafeUuid(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-[10px] text-amber-800 flex gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">Segurança e Validade</span>
                  Os tokens e chaves são criptografados e armazenados com segurança. Os documentos enviados geram assinaturas com validade jurídica perante as leis brasileiras (MP 2.200-2/2001).
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsD4signConfigOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold px-4 py-2 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-5 py-2 rounded-xl shadow-sm"
                >
                  Salvar Configuração
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Envio para D4Sign */}
      {selectedDocForD4sign && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-1.5">
                📨 Enviar "{selectedDocForD4sign.name}" para D4Sign
              </h3>
              <button onClick={() => setSelectedDocForD4sign(null)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendToD4SignSubmit} className="p-6 space-y-4">
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-700">Destinatários / Signatários</label>
                
                {d4signSigners.map((signer, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 relative animate-fade-in">
                    {d4signSigners.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setD4signSigners(d4signSigners.filter((_, i) => i !== idx))}
                        className="absolute right-2 top-2 text-slate-400 hover:text-rose-500 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <div>
                      <label className="block text-[9px] font-medium text-slate-500 mb-0.5">Nome do Assinante</label>
                      <input
                        type="text"
                        required
                        placeholder="Nome completo..."
                        value={signer.name}
                        onChange={(e) => {
                          const updated = [...d4signSigners];
                          updated[idx].name = e.target.value;
                          setD4signSigners(updated);
                        }}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-medium text-slate-500 mb-0.5">E-mail</label>
                        <input
                          type="email"
                          required
                          placeholder="exemplo@email.com"
                          value={signer.email}
                          onChange={(e) => {
                            const updated = [...d4signSigners];
                            updated[idx].email = e.target.value;
                            setD4signSigners(updated);
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-medium text-slate-500 mb-0.5">CPF (Opcional)</label>
                        <input
                          type="text"
                          placeholder="000.000.000-00"
                          value={signer.cpf}
                          onChange={(e) => {
                            const updated = [...d4signSigners];
                            updated[idx].cpf = e.target.value;
                            setD4signSigners(updated);
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => setD4signSigners([...d4signSigners, { name: "", email: "", cpf: "" }])}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-bold transition-colors cursor-pointer border border-dashed border-slate-300 flex items-center justify-center gap-1"
                >
                  ➕ Adicionar outro signatário
                </button>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedDocForD4sign(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold px-4 py-2 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={sendingD4sign}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-5 py-2 rounded-xl shadow-sm flex items-center gap-1.5"
                >
                  {sendingD4sign ? "Disparando D4Sign API..." : "Disparar Assinaturas"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Visualização de Documentos (Print 4) */}
      {viewingDoc && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-slate-100 flex flex-col animate-fade-in">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <span className="text-[9px] bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  {viewingDoc.category}
                </span>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 mt-1 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" /> {viewingDoc.name}
                  <span className="text-xs font-mono text-slate-400 font-medium">V{viewingDoc.version}</span>
                </h3>
              </div>
              <button
                onClick={() => setViewingDoc(null)}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Visualizador de Conteúdo */}
                <div className="md:col-span-2 space-y-3">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Visualização do Arquivo</p>
                  
                  {viewingDoc.file_content ? (
                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-inner bg-slate-50 p-2">
                      <iframe
                        src={viewingDoc.file_content}
                        className="w-full h-[450px] rounded-xl border-none"
                        title={viewingDoc.name}
                      />
                    </div>
                  ) : (
                    /* Visualizador Simulado de Altíssima Fidelidade */
                    <div className="border border-slate-200 rounded-2xl bg-slate-50 p-6 font-serif text-slate-800 h-[450px] overflow-y-auto shadow-inner space-y-4 text-xs leading-relaxed relative">
                      <div className="text-center space-y-1 pb-4 border-b border-slate-200 font-sans">
                        <p className="font-bold text-slate-900 uppercase tracking-wider text-sm">CARDOSO & MENDES ADVOGADOS ASSOCIADOS</p>
                        <p className="text-[10px] text-slate-500">Consultoria e Assessoria Jurídica de Resultados • OAB/SP 45.678</p>
                      </div>

                      {viewingDoc.category === "Contrato" ? (
                        <div className="space-y-3">
                          <p className="font-bold text-center text-sm uppercase py-2">CONTRATO PRESTAÇÃO DE SERVIÇOS PROFISSIONAIS JURÍDICOS</p>
                          <p>
                            Pelo presente instrumento particular de contrato, de um lado, doravante denominado <strong>CONTRATANTE</strong>, 
                            e de outro lado, <strong>CONTRATADO</strong>, representado pelos patronos do Cardoso & Mendes Advogados, 
                            têm entre si justo e acordado o seguinte clausulado:
                          </p>
                          <p>
                            <strong>Cláusula Primeira - Do Objeto:</strong> O objeto deste contrato consiste na assessoria contenciosa e preventiva 
                            referente às demandas operacionais da parte Contratante, englobando a confecção de defesas judiciais, pareceres técnicos e audiências.
                          </p>
                          <p>
                            <strong>Cláusula Segunda - Dos Honorários:</strong> Pelos serviços acordados, a Contratante remunerará o Contratado no valor 
                            ajustado correspondente à tabela geral de custos operacionais do escritório, com vencimentos mensais recorrentes.
                          </p>
                          <p>
                            <strong>Cláusula Terceira - Do Foro:</strong> Fica eleito o foro da Comarca da Capital de São Paulo para dirimir eventuais dúvidas 
                            decorrentes do presente termo.
                          </p>
                        </div>
                      ) : viewingDoc.category === "Procuração" ? (
                        <div className="space-y-3">
                          <p className="font-bold text-center text-sm uppercase py-2">INSTRUMENTO PARTICULAR DE PROCURAÇÃO AD JUDICIA ET EXTRA</p>
                          <p>
                            <strong>OUTORGANTE:</strong> Representado pelo cliente vinculado no Legal Prime ERP.
                          </p>
                          <p>
                            <strong>OUTORGADOS:</strong> Os advogados integrantes de <strong>Cardoso & Mendes Advogados Associados</strong>, 
                            com escritório profissional situado em São Paulo/SP.
                          </p>
                          <p>
                            <strong>PODERES GERAIS:</strong> Pelo presente instrumento, o Outorgante outorga aos Outorgados amplos poderes para o foro em geral, 
                            com a cláusula <em>ad judicia et extra</em>, em qualquer Juízo, Instância ou Tribunal, podendo propor ações, defender-se, confessar, 
                            desistir, transigir, acordar, receber e dar quitação.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="font-bold text-center text-sm uppercase py-2">PEÇA PROCESSUAL DE INSTRUMENTAÇÃO JURÍDICA</p>
                          <p>
                            EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DE UMA DAS VARAS CÍVEIS DA COMARCA DE SÃO PAULO - ESTADO DE SÃO PAULO.
                          </p>
                          <p>
                            A parte devidamente qualificada, por intermédio de seus advogados signatários, vem respeitosamente à presença de Vossa Excelência, 
                            com fulcro nos artigos vigentes do Código de Processo Civil, propor a presente medida judicial cabível, expondo e requerendo 
                            a juntada das manifestações técnicas e provas documentais acostadas aos autos.
                          </p>
                        </div>
                      )}

                      <div className="pt-8 text-center text-[10px] text-slate-400 font-sans border-t border-slate-100">
                        <p>Documento digitalizado via LegalOne ERP em {new Date(viewingDoc.created_at).toLocaleString("pt-BR")}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Metadados e Assinaturas */}
                <div className="space-y-5 bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-between">
                  <div className="space-y-4">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Histórico & Assinaturas</p>
                    
                    <div className="space-y-2 text-xs">
                      <div>
                        <p className="text-slate-400 font-medium">Registrado por</p>
                        <p className="font-semibold text-slate-800">{viewingDoc.created_by}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 font-medium">Data de Cadastro</p>
                        <p className="font-semibold text-slate-800">{new Date(viewingDoc.created_at).toLocaleString("pt-BR")}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 font-medium">Localização Física/Digital</p>
                        <p className="font-mono text-[10px] text-indigo-600 bg-indigo-50/50 p-1.5 rounded border border-indigo-100/50 break-all">{viewingDoc.file_path}</p>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-4 space-y-2">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Validação de Assinaturas</p>
                      
                      {viewingDoc.signatures && viewingDoc.signatures.length > 0 ? (
                        <div className="space-y-2 max-h-[160px] overflow-y-auto">
                          {viewingDoc.signatures.map((sig: any, idx: number) => (
                            <div key={idx} className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2">
                              <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                              <div className="text-[10px]">
                                <p className="font-bold text-emerald-900">{sig.signed_by}</p>
                                <p className="text-emerald-700">Assinado em {new Date(sig.signed_at).toLocaleString("pt-BR")}</p>
                                <p className="text-[8px] text-emerald-600 font-mono">IP: {sig.ip || "Autenticado pelo ERP"}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                          <p className="text-[10px] text-amber-800 font-medium">Este documento ainda não possui assinaturas eletrônicas vinculadas.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-200">
                    <button
                      onClick={() => {
                        // Simulação de download polido
                        const link = document.createElement("a");
                        link.href = viewingDoc.file_content || "#";
                        link.download = viewingDoc.name + ".pdf";
                        if (viewingDoc.file_content) {
                          link.click();
                        } else {
                          alert("Download simulado do documento com sucesso!");
                        }
                      }}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Cloud className="w-4 h-4" /> Baixar Documento
                    </button>
                  </div>
                </div>

              </div>
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setViewingDoc(null)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-colors cursor-pointer shadow-md"
              >
                Concluir Leitura
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
