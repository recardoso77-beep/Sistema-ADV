import React, { useState } from "react";
import { Scale, Search, Plus, X, Calendar, User, FileText, Sparkles, ShieldAlert, CheckCircle2, ChevronRight, HelpCircle, RefreshCw } from "lucide-react";
import { Process, Client, ProcessMovement } from "../types";

interface ProcessesProps {
  processes: Process[];
  clients: Client[];
  token: string;
  onRefresh: () => Promise<void>;
  userRole: string;
}

export default function Processes({ processes, clients, token, onRefresh, userRole }: ProcessesProps) {
  const [search, setSearch] = useState("");
  const [filterArea, setFilterArea] = useState("all");
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);

  // Expanded process details cache
  const [detailedProcess, setDetailedProcess] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // AI outputs cache
  const [aiSummary, setAiSummary] = useState("");
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  
  const [aiRisk, setAiRisk] = useState("");
  const [aiRiskLoading, setAiRiskLoading] = useState(false);

  const [explainJargonInput, setExplainJargonInput] = useState("");
  const [explainJargonOutput, setExplainJargonOutput] = useState("");
  const [explainJargonLoading, setExplainJargonLoading] = useState(false);

  // Form State
  const [formCnj, setFormCnj] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formClientId, setFormClientId] = useState("");
  const [formArea, setFormArea] = useState("Cível");
  const [formCourt, setFormCourt] = useState("TJSP");
  const [formComarca, setFormComarca] = useState("");
  const [formVara, setFormVara] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formLawyers, setFormLawyers] = useState<string[]>([]);
  const [newLawyerName, setNewLawyerName] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Court Search & Crawl states
  const [searchMode, setSearchMode] = useState<"auto" | "manual">("auto");
  const [courtQuery, setCourtQuery] = useState("");
  const [searchingCourts, setSearchingCourts] = useState(false);
  const [courtSearchResults, setCourtSearchResults] = useState<any[]>([]);
  const [selectedClientForImport, setSelectedClientForImport] = useState<{[key: string]: string}>({});

  const detectQueryType = (q: string): string => {
    const clean = q.trim();
    if (!clean) return "";

    const digitsOnly = clean.replace(/\D/g, "");
    
    // CNJ Check
    const cnjRegex = /^\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}$/;
    if (cnjRegex.test(clean) || (digitsOnly.length === 20 && /^\d+$/.test(digitsOnly))) {
      return "CNJ";
    }

    // OAB Check
    const oabRegex = /oab/i;
    const oabSuffixRegex = /\b\d+[\s\/-]?[A-Z]{2}\b/i;
    const oabPrefixSuffixRegex = /\b[A-Z]{2}[\s\/-]?\d+\b/i;
    if (oabRegex.test(clean) || oabSuffixRegex.test(clean) || oabPrefixSuffixRegex.test(clean)) {
      return "OAB";
    }

    // Party Check
    const partyIndicators = [
      "ltda", "s/a", "s\\.a\\.", "me", "eireli", "inc", "co", "corp", "empresa", "banco", "seguradora", "comercio", "servicos", "associa", "fundacao", "instituto", "cooperativa"
    ];
    const cleanLower = clean.toLowerCase();
    const isCompany = partyIndicators.some(indicator => {
      const regex = new RegExp(`\\b${indicator}\\b`, "i");
      return regex.test(cleanLower);
    });

    if (isCompany) {
      return "Parte";
    }

    return "Nome";
  };

  const handleSearchCourts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courtQuery.trim()) return;
    setSearchingCourts(true);
    setErrorMsg("");
    setCourtSearchResults([]);

    // LOG: Pesquisa enviada
    console.log(`[FRONTEND] Pesquisa enviada: "${courtQuery}"`);

    try {
      const res = await fetch(`/api/processes/search-courts?query=${encodeURIComponent(courtQuery)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // LOG: Status HTTP
      console.log(`[FRONTEND] Status HTTP recebido: ${res.status}`);

      if (res.ok) {
        const data = await res.json();
        
        // LOG: Payload recebido e Quantidade de processos
        console.log("[FRONTEND] Payload recebido:", data);
        console.log(`[FRONTEND] Quantidade de processos retornados: ${data.length}`);

        setCourtSearchResults(data);
        if (data.length === 0) {
          setErrorMsg("Nenhum processo encontrado.");
        }
      } else {
        let errMessage = "Erro ao consultar os tribunais.";
        let errStack = "";
        try {
          const errData = await res.json();
          errMessage = errData.error || errMessage;
          errStack = errData.stack || "";
        } catch (jsonErr) {}

        // LOG: Erro e Stack completa
        console.error(`[FRONTEND] Erro da requisição: ${errMessage}`);
        if (errStack) {
          console.error(`[FRONTEND] Stack completa: ${errStack}`);
        }

        // Elegant error message mapping based on status or message content
        if (res.status === 401 || res.status === 403) {
          setErrorMsg("Erro de autenticação. Por favor, verifique se sua sessão expirou.");
        } else if (res.status === 408 || res.status === 504) {
          setErrorMsg("Tempo limite excedido. O tribunal demorou muito para responder.");
        } else if (res.status === 503) {
          setErrorMsg("Tribunal indisponível. Tente novamente mais tarde.");
        } else if (errMessage.toLowerCase().includes("key") || errMessage.toLowerCase().includes("not configured")) {
          setErrorMsg("Erro de autenticação ou API temporariamente indisponível (Chave de API não configurada).");
        } else {
          setErrorMsg(errMessage);
        }
      }
    } catch (err: any) {
      // LOG: Erro e Stack completa
      console.error("[FRONTEND] Erro de rede:", err.message);
      console.error("[FRONTEND] Stack completa:", err.stack);
      setErrorMsg("API temporariamente indisponível. Por favor, verifique sua conexão de rede.");
    } finally {
      setSearchingCourts(false);
    }
  };

  const handleImportProcess = async (crawled: any, idx: number) => {
    const clientId = selectedClientForImport[idx];
    if (!clientId) {
      setErrorMsg("Selecione um cliente no dropdown correspondente antes de importar o processo.");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    try {
      const payload = {
        cnj: crawled.cnj,
        title: crawled.title,
        client_id: clientId,
        area: crawled.area || "Cível",
        court: crawled.court || "TJSP",
        comarca: crawled.comarca || "",
        vara: crawled.vara || "",
        description: crawled.description || "",
        value: Number(crawled.value) || 0,
        lawyers: crawled.lawyers || [],
        status: "Ativo",
        initial_movements: crawled.movements || [],
      };

      const res = await fetch("/api/processes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await onRefresh();
        setIsNewModalOpen(false);
        // Reset states
        setCourtQuery("");
        setCourtSearchResults([]);
        setSelectedClientForImport({});
      } else {
        const data = await res.json();
        setErrorMsg(data.error || "Erro ao importar processo.");
      }
    } catch (err) {
      setErrorMsg("Erro de rede ao salvar o processo importado.");
    } finally {
      setLoading(false);
    }
  };

  const filteredProcesses = processes.filter((p) => {
    const query = search.toLowerCase();
    const matchesSearch =
      p.cnj.includes(query) ||
      p.title.toLowerCase().includes(query) ||
      p.court.toLowerCase().includes(query);
    
    if (filterArea === "all") return matchesSearch;
    return matchesSearch && p.area === filterArea;
  });

  const handleFetchDetails = async (id: string) => {
    setSelectedProcessId(id);
    setDetailsLoading(true);
    setAiSummary("");
    setAiRisk("");
    setExplainJargonInput("");
    setExplainJargonOutput("");

    try {
      const res = await fetch(`/api/processes/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setDetailedProcess(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleSimulateIntimation = async () => {
    if (!detailedProcess) return;
    try {
      const descriptions = [
        "Juntada de Petição de manifestação sobre laudo pericial.",
        "Proferida sentença: Julgado PROCEDENTE em parte o pedido inicial para condenar a ré.",
        "Conclusos os autos para decisão ao Juiz de Direito responsável.",
        "Publicação oficial: Intimem-se as partes para manifestação no prazo de 5 dias.",
      ];
      const randomDesc = descriptions[Math.floor(Math.random() * descriptions.length)];

      const res = await fetch(`/api/processes/${detailedProcess.id}/movements`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          description: randomDesc,
          source: "Automatizado",
        }),
      });

      if (res.ok) {
        // Reload details
        await handleFetchDetails(detailedProcess.id);
        await onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAiSummarize = async () => {
    if (!detailedProcess) return;
    setAiSummaryLoading(true);
    setAiSummary("");
    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: detailedProcess.title,
          area: detailedProcess.area,
          description: detailedProcess.description,
          processId: detailedProcess.id,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setAiSummary(data.summary);
      } else {
        setAiSummary("⚠️ " + (data.error || "Erro ao gerar resumo."));
      }
    } catch (err) {
      setAiSummary("⚠️ Falha de comunicação.");
    } finally {
      setAiSummaryLoading(false);
    }
  };

  const handleAiRisk = async () => {
    if (!detailedProcess) return;
    setAiRiskLoading(true);
    setAiRisk("");
    try {
      const res = await fetch("/api/ai/risk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: detailedProcess.title,
          description: detailedProcess.description,
          value: detailedProcess.value,
          processId: detailedProcess.id,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setAiRisk(data.riskAnalysis);
      } else {
        setAiRisk("⚠️ " + (data.error || "Erro na análise de risco."));
      }
    } catch (err) {
      setAiRisk("⚠️ Falha de comunicação.");
    } finally {
      setAiRiskLoading(false);
    }
  };

  const handleExplainJargon = async () => {
    if (!explainJargonInput.trim()) return;
    setExplainJargonLoading(true);
    setExplainJargonOutput("");
    try {
      const res = await fetch("/api/ai/explain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: detailedProcess.title,
          description: detailedProcess.description,
          technicalText: explainJargonInput,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setExplainJargonOutput(data.explanation);
      } else {
        setExplainJargonOutput("⚠️ " + (data.error || "Erro na explicação."));
      }
    } catch (err) {
      setExplainJargonOutput("⚠️ Falha.");
    } finally {
      setExplainJargonLoading(false);
    }
  };

  const handleAddLawyer = () => {
    if (!newLawyerName.trim()) return;
    setFormLawyers([...formLawyers, newLawyerName.trim()]);
    setNewLawyerName("");
  };

  const handleRemoveLawyer = (idx: number) => {
    setFormLawyers(formLawyers.filter((_, i) => i !== idx));
  };

  const handleCreateProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCnj.trim() || !formTitle.trim() || !formClientId) {
      setErrorMsg("CNJ, título e cliente são obrigatórios.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    const payload = {
      cnj: formCnj,
      title: formTitle,
      client_id: formClientId,
      area: formArea,
      court: formCourt,
      comarca: formComarca,
      vara: formVara,
      description: formDescription,
      value: parseFloat(formValue) || 0,
      lawyers: formLawyers,
      status: "Ativo",
    };

    try {
      const res = await fetch("/api/processes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await onRefresh();
        setIsNewModalOpen(false);
        // Reset states
        setFormCnj("");
        setFormTitle("");
        setFormClientId("");
        setFormArea("Cível");
        setFormCourt("TJSP");
        setFormComarca("");
        setFormVara("");
        setFormDescription("");
        setFormValue("");
        setFormLawyers([]);
      } else {
        const data = await res.json();
        setErrorMsg(data.error || "Erro ao salvar o processo.");
      }
    } catch (err) {
      setErrorMsg("Falha ao comunicar com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" id="processes-module-view">
      {/* Header and trigger */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Gestão de Processos</h2>
          <p className="text-xs text-slate-400 mt-1">Acompanhe andamentos, intimados e workflows de ações jurídicas.</p>
        </div>
        {userRole !== "client" && (
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" /> Novo Processo
          </button>
        )}
      </div>

      {/* Main split: left process list, right detail viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: Processes list (8 cols if detail open, else 12) */}
        <div className={`lg:col-span-6 space-y-4`}>
          {/* Filters & Search */}
          <div className="bg-white border border-slate-200 p-4 rounded-2xl space-y-3 shadow-2xs">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrar por CNJ, Tribunal ou Título..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-2 rounded-xl text-xs outline-none focus:border-indigo-500 text-slate-800"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {["all", "Cível", "Trabalhista", "Penal", "Tributário"].map((area) => (
                <button
                  key={area}
                  onClick={() => setFilterArea(area)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                    filterArea === area ? "bg-indigo-600 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {area === "all" ? "Todas Áreas" : area}
                </button>
              ))}
            </div>
          </div>

          {/* Processes List Grid */}
          <div className="space-y-3">
            {filteredProcesses.map((p) => (
              <div
                key={p.id}
                onClick={() => handleFetchDetails(p.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer text-xs ${
                  selectedProcessId === p.id
                    ? "bg-indigo-50/50 border-indigo-200 shadow-xs"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[9px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                      {p.court} • {p.area}
                    </span>
                    <h3 className="font-semibold text-slate-800 mt-2 text-[13px]">{p.title}</h3>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{p.cnj}</p>
                  </div>
                  <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                    p.status === "Ativo" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-slate-100 text-slate-600"
                  }`}>
                    {p.status}
                  </span>
                </div>

                <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-500">
                  <span className="font-mono">Valor: R$ {p.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  <span className="text-indigo-600 flex items-center gap-0.5">Andamentos <ChevronRight className="w-3.5 h-3.5" /></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Col: Details view */}
        <div className="lg:col-span-6">
          {selectedProcessId ? (
            detailedProcess && !detailsLoading ? (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-5 space-y-6">
                {/* Upper Ficha */}
                <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="font-semibold text-sm text-slate-900">{detailedProcess.title}</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{detailedProcess.cnj}</p>
                  </div>
                  {userRole !== "client" && (
                    <button
                      onClick={handleSimulateIntimation}
                      className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-1.5 rounded-xl font-medium hover:bg-indigo-100 flex items-center gap-1 cursor-pointer transition-colors"
                      title="Simula a varredura automática do tribunal e insere um andamento de teste."
                    >
                      <RefreshCw className="w-3 h-3 animate-spin" /> Capturar Tribunal
                    </button>
                  )}
                </div>

                {/* Info Card Grid */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl text-[11px]">
                  <div>
                    <span className="text-slate-400 block font-medium">Cliente</span>
                    <span className="font-semibold text-slate-800 truncate block">{detailedProcess.client?.name || "Sportix Shop"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Juízo / Vara</span>
                    <span className="font-semibold text-slate-800 block truncate">{detailedProcess.comarca} - {detailedProcess.vara}</span>
                  </div>
                  <div className="mt-2">
                    <span className="text-slate-400 block font-medium">Valor da Causa</span>
                    <span className="font-semibold text-slate-800 block">R$ {detailedProcess.value?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="mt-2">
                    <span className="text-slate-400 block font-medium">Advogados Atribuídos</span>
                    <span className="font-semibold text-indigo-700 truncate block">
                      {detailedProcess.lawyers?.join(", ") || "Rodrigo Cardoso"}
                    </span>
                  </div>
                </div>

                {/* IA Copilot Section */}
                <div className="border border-indigo-100 bg-indigo-50/20 p-4 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-xs text-indigo-950 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" /> Inteligência Jurídica Copilot
                    </h4>
                    <span className="text-[9px] bg-indigo-600/10 text-indigo-600 px-2 py-0.5 rounded-full font-medium">Gemini 3.5</span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleAiSummarize}
                      disabled={aiSummaryLoading}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[10px] px-3 py-2 rounded-xl font-medium transition-colors cursor-pointer flex items-center gap-1"
                    >
                      {aiSummaryLoading ? "Analisando..." : "Resumir Processo por IA"}
                    </button>
                    {userRole !== "client" && (
                      <button
                        onClick={handleAiRisk}
                        disabled={aiRiskLoading}
                        className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-[10px] px-3 py-2 rounded-xl font-medium transition-colors cursor-pointer flex items-center gap-1"
                      >
                        {aiRiskLoading ? "Processando..." : "Análise de Risco IA"}
                      </button>
                    )}
                  </div>

                  {/* AI Output summaries */}
                  {aiSummary && (
                    <div className="bg-white border border-indigo-100/80 p-3.5 rounded-xl shadow-2xs space-y-2">
                      <h5 className="font-semibold text-[11px] text-indigo-950 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-indigo-600" /> Resumo Estruturado do Caso:
                      </h5>
                      <div className="text-[11px] text-slate-700 leading-relaxed whitespace-pre-line border-l-2 border-indigo-400 pl-2.5">
                        {aiSummary}
                      </div>
                    </div>
                  )}

                  {aiRisk && (
                    <div className="bg-slate-900 text-slate-100 p-3.5 rounded-xl shadow-md space-y-2">
                      <h5 className="font-semibold text-[11px] text-amber-400 flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5" /> Prognóstico & provisionamento financeiro:
                      </h5>
                      <div className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-line border-l-2 border-amber-400 pl-2.5 font-sans">
                        {aiRisk}
                      </div>
                    </div>
                  )}

                  {/* Plain language Jargon Explainer tool */}
                  <div className="space-y-1.5 pt-2 border-t border-indigo-100/50">
                    <label className="text-[10px] text-indigo-950 font-medium flex items-center gap-1">
                      <HelpCircle className="w-3 h-3 text-indigo-600" /> Traduzir "Juridiquês" do andamento para o cliente:
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Ex: Juntada de embargos infringentes..."
                        value={explainJargonInput}
                        onChange={(e) => setExplainJargonInput(e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-800 outline-none flex-1 focus:border-indigo-500"
                      />
                      <button
                        onClick={handleExplainJargon}
                        disabled={explainJargonLoading || !explainJargonInput}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[10px] px-3 py-1.5 rounded-lg font-medium transition-all"
                      >
                        {explainJargonLoading ? "Traduzindo..." : "Explicar"}
                      </button>
                    </div>

                    {explainJargonOutput && (
                      <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-lg mt-1 text-[11px] text-slate-800 leading-relaxed">
                        <p className="font-semibold text-emerald-800 mb-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Como dizer ao cliente de forma simples:
                        </p>
                        <p className="italic">"{explainJargonOutput}"</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Movements timeline */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-slate-900 text-xs">Histórico de Andamentos Judiciais</h4>
                  <div className="border-l border-slate-200 ml-2 pl-4 space-y-4 max-h-[300px] overflow-y-auto pr-1">
                    {detailedProcess.movements?.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">Nenhum andamento ou publicação registrada neste processo.</p>
                    ) : (
                      detailedProcess.movements.map((mov: ProcessMovement) => (
                        <div key={mov.id} className="relative text-[11px]">
                          <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
                            mov.source === "Automatizado" ? "bg-indigo-600 animate-pulse" : "bg-slate-400"
                          }`} />
                          <div className="text-[9px] text-slate-400 font-mono">
                            {new Date(mov.date).toLocaleString("pt-BR")} • <span className="font-semibold text-slate-500">{mov.source}</span>
                          </div>
                          <p className="text-slate-700 font-medium mt-0.5">{mov.description}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-44 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 text-xs p-5">
                <RefreshCw className="w-6 h-6 text-slate-300 animate-spin mb-2" />
                Carregando histórico processual...
              </div>
            )
          ) : (
            <div className="h-64 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 text-xs p-6 text-center">
              <Scale className="w-10 h-10 text-slate-300 mb-2 opacity-75" />
              <p className="font-semibold text-slate-500">Nenhum processo selecionado</p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-xs">Escolha um processo na lista lateral para visualizar a ficha do caso, movimentações automatizadas e triggers de inteligência artificial.</p>
            </div>
          )}
        </div>
      </div>

      {/* New Process Form Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600 animate-pulse" /> Cadastrar Novo Processo Judicial
              </h3>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Abas de Modo de Cadastro */}
            <div className="flex border-b border-slate-100 bg-slate-50 p-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setSearchMode("auto");
                  setErrorMsg("");
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  searchMode === "auto"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-200/60"
                }`}
              >
                🔍 Busca nos Tribunais (CNJ / OAB / Nome)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchMode("manual");
                  setErrorMsg("");
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  searchMode === "manual"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-200/60"
                }`}
              >
                ✍️ Inserção Manual
              </button>
            </div>

            {/* MODO 1: BUSCA AUTOMÁTICA NOS TRIBUNAIS */}
            {searchMode === "auto" ? (
              <div className="space-y-4">
                {/* Search Bar */}
                <form onSubmit={handleSearchCourts} className="p-6 space-y-4 border-b border-slate-100 bg-slate-50/40">
                  {errorMsg && (
                    <div className="p-3 bg-rose-50 text-rose-700 border border-rose-100 rounded-lg text-xs flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Pesquise pelo CNJ do Processo, OAB do Advogado ou Nome do Advogado/Parte:
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          placeholder="Ex: 1002345-67.2024.8.26.0100, 123456/SP ou Rodrigo Cardoso..."
                          value={courtQuery}
                          onChange={(e) => setCourtQuery(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3 py-2.5 text-xs text-slate-800 outline-none focus:border-indigo-500 transition-all focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={searchingCourts}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-colors shrink-0 flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        {searchingCourts ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" /> Consultando...
                          </>
                        ) : (
                          "Consultar Tribunais"
                        )}
                      </button>
                    </div>
                    {courtQuery.trim() && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 font-medium">Busca Inteligente detectou:</span>
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1">
                          ✨ Consulta por {detectQueryType(courtQuery)}
                        </span>
                      </div>
                    )}
                    <span className="block text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                      O sistema fará uma busca integrada e varredura automática em diários de justiça e bancos de dados de tribunais brasileiros (TJSP, TRT2, TRF3, STJ, etc.) retornando os dados completos para importação instantânea.
                    </span>
                  </div>
                </form>

                {/* Search Results Display */}
                <div className="p-6 space-y-4">
                  {searchingCourts ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center">
                      <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
                      <h4 className="text-xs font-bold text-slate-700">Fazendo Varredura nos Sistemas de Justiça</h4>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-xs leading-relaxed">
                        Consultando distribuições eletrônicas, andamentos e publicações oficiais correspondentes ao termo informado. Por favor, aguarde alguns instantes...
                      </p>
                    </div>
                  ) : courtSearchResults.length > 0 ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs font-bold text-slate-700">Processos Encontrados ({courtSearchResults.length})</h4>
                        <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 flex items-center gap-1">
                          ● Conectado aos Tribunais
                        </span>
                      </div>
                      
                      <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                        {courtSearchResults.map((resItem, idx) => (
                          <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 relative shadow-xs">
                            <div className="flex justify-between items-start gap-4">
                              <div>
                                <span className="text-[9px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                                  {resItem.court} • {resItem.area}
                                </span>
                                <h5 className="font-semibold text-xs text-slate-900 mt-1.5">{resItem.title}</h5>
                                <p className="text-[11px] text-slate-500 font-mono mt-0.5">{resItem.cnj}</p>
                              </div>
                              <span className="text-xs font-bold text-emerald-600 shrink-0">
                                {Number(resItem.value) > 0 ? Number(resItem.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Valor não informado"}
                              </span>
                            </div>

                            <div className="text-[11px] text-slate-600 leading-relaxed bg-white p-3 rounded-xl border border-slate-100">
                              <strong className="text-slate-800">Resumo da Petição/Fatos:</strong> {resItem.description}
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-[10px] text-slate-600">
                              <div>
                                <span className="block text-slate-400 font-medium">Comarca & Vara:</span>
                                <span className="font-medium text-slate-800">{resItem.comarca} — {resItem.vara}</span>
                              </div>
                              <div>
                                <span className="block text-slate-400 font-medium">Patronos / Advogados:</span>
                                <span className="font-medium text-slate-800">{Array.isArray(resItem.lawyers) ? resItem.lawyers.join(", ") : resItem.lawyers}</span>
                              </div>
                            </div>

                            {resItem.movements && resItem.movements.length > 0 && (
                              <div className="space-y-1 bg-white/60 p-3 rounded-xl border border-slate-150 text-[10px]">
                                <span className="font-bold text-slate-700 block mb-1">Últimos Andamentos Encontrados ({resItem.movements.length}):</span>
                                {resItem.movements.slice(0, 3).map((mov: any, mIdx: number) => (
                                  <div key={mIdx} className="text-slate-600 border-l-2 border-indigo-400 pl-2.5 py-0.5 mt-1.5">
                                    <span className="font-mono text-slate-400 text-[9px]">{new Date(mov.date).toLocaleDateString("pt-BR")}</span> — {mov.description}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Action Area for Import */}
                            <div className="pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row gap-3 items-end sm:items-center justify-between bg-white -mx-4 -mb-4 p-4 rounded-b-2xl">
                              <div className="w-full sm:max-w-xs text-left">
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Vincular este processo a qual Cliente?</label>
                                <select
                                  required
                                  value={selectedClientForImport[idx] || ""}
                                  onChange={(e) => setSelectedClientForImport({...selectedClientForImport, [idx]: e.target.value})}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-500"
                                >
                                  <option value="">Selecione o cliente cadastrado...</option>
                                  {clients.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name} ({c.document})
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleImportProcess(resItem, idx)}
                                disabled={loading}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm shrink-0 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                              >
                                {loading ? "Importando..." : "📥 Importar para o ERP"}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 text-xs text-center p-6 bg-slate-50/30">
                      <Search className="w-8 h-8 text-slate-300 mb-2" />
                      <p className="font-semibold text-slate-500">Nenhum processo consultado nesta sessão</p>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-xs leading-relaxed">
                        Digite uma OAB, nome do advogado/parte ou o número único CNJ na barra superior para realizar a busca automática no Tribunal.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* MODO 2: CADASTRO MANUAL CLÁSSICO */
              <form onSubmit={handleCreateProcess} className="p-6 space-y-4">
                {errorMsg && (
                  <div className="p-3 bg-rose-50 text-rose-700 border border-rose-100 rounded-lg text-xs flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-500" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Numeração Única CNJ</label>
                    <input
                      type="text"
                      required
                      placeholder="0000000-00.0000.0.00.0000"
                      value={formCnj}
                      onChange={(e) => setFormCnj(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Título Resumido da Ação</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Execução Contratual contra Fornecedor"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Vincular ao Cliente</label>
                    <select
                      required
                      value={formClientId}
                      onChange={(e) => setFormClientId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                    >
                      <option value="">Selecione um cliente...</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.document})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Área do Direito</label>
                    <select
                      value={formArea}
                      onChange={(e) => setFormArea(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                    >
                      <option value="Cível">Cível</option>
                      <option value="Trabalhista">Trabalhista</option>
                      <option value="Penal">Penal</option>
                      <option value="Tributário">Tributário</option>
                      <option value="Família">Família</option>
                      <option value="Previdenciário">Previdenciário</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Tribunal</label>
                    <select
                      value={formCourt}
                      onChange={(e) => setFormCourt(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                    >
                      <option value="TJSP">TJSP</option>
                      <option value="TRT2">TRT2</option>
                      <option value="TRF3">TRF3</option>
                      <option value="STJ">STJ</option>
                      <option value="STF">STF</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Comarca</label>
                    <input
                      type="text"
                      placeholder="Ex: São Paulo"
                      value={formComarca}
                      onChange={(e) => setFormComarca(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Vara Competente</label>
                    <input
                      type="text"
                      placeholder="Ex: 2ª Vara Cível"
                      value={formVara}
                      onChange={(e) => setFormVara(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Valor do Pedido/Causa (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Ex: 50000"
                      value={formValue}
                      onChange={(e) => setFormValue(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>
                  {/* Assign lawyers */}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Atribuir Advogados</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Nome do Advogado"
                        value={newLawyerName}
                        onChange={(e) => setNewLawyerName(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none flex-1"
                      />
                      <button
                        type="button"
                        onClick={handleAddLawyer}
                        className="bg-indigo-600 text-white rounded-xl text-xs px-3 font-semibold hover:bg-indigo-500 cursor-pointer"
                      >
                        + Atribuir
                      </button>
                    </div>
                    {formLawyers.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {formLawyers.map((l, idx) => (
                          <span key={idx} className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-lg text-[9px] flex items-center gap-1 font-medium">
                            {l}
                            <button type="button" onClick={() => handleRemoveLawyer(idx)} className="text-indigo-400 hover:text-rose-600">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1 font-semibold">Resumo dos Fatos / Petição</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Relato circunstanciado dos fatos e fundamentos iniciais do processo..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none resize-none"
                  />
                </div>

                <div className="p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-start gap-2 text-[10px] text-slate-600">
                  <Sparkles className="w-4 h-4 text-indigo-600 flex-shrink-0 animate-pulse" />
                  <div>
                    <p className="font-semibold text-indigo-950">Automação de Workflows Ativada</p>
                    <p className="mt-0.5">Ao cadastrar, o sistema criará pastas iniciais automáticas e agendará tarefas de análise inicial para os advogados atribuídos.</p>
                  </div>
                </div>

                {/* Submit */}
                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsNewModalOpen(false)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-5 py-2 rounded-xl transition-colors cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {loading ? "Gravando..." : "Cadastrar Processo"}
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
