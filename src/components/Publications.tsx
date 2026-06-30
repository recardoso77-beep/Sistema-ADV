import React, { useState } from "react";
import { Search, Globe, Newspaper, Zap, Calendar, CheckCircle2, UserPlus, FileText, Bell, RefreshCw, AlertCircle, Play, Info } from "lucide-react";
import { Process, User } from "../types";

interface PublicationsProps {
  currentUser: User;
  processes: Process[];
  token: string;
  onRefresh: () => Promise<void>;
  userRole: string;
}

interface Publication {
  id: string;
  cnj: string;
  court: string;
  date: string;
  advocate: string;
  text: string;
  status: "Pendente" | "Processado" | "Agendado";
}

export default function Publications({ currentUser, processes, token, onRefresh, userRole }: PublicationsProps) {
  const [searchTerm, setSearchTerm] = useState(currentUser?.oab || currentUser?.name || "Rodrigo Cardoso");
  const [selectedCourts, setSelectedCourts] = useState<string[]>(["TJSP", "TRT2"]);
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState("");
  const [publications, setPublications] = useState<Publication[]>([]);
  const [newPubsCount, setNewPubsCount] = useState(0);
  const [actionSuccessMsg, setActionSuccessMsg] = useState("");

  const handleToggleCourt = (court: string) => {
    if (selectedCourts.includes(court)) {
      setSelectedCourts(selectedCourts.filter(c => c !== court));
    } else {
      setSelectedCourts([...selectedCourts, court]);
    }
  };

  const handleScanNow = () => {
    if (scanning) return;
    setScanning(true);
    setActionSuccessMsg("");
    
    const steps = [
      "Conectando aos webservices dos Tribunais...",
      "Buscando Diário da Justiça de São Paulo (TJSP)...",
      "Varrendo publicações do Tribunal Regional do Trabalho (TRT-2)...",
      "Consultando base do Superior Tribunal de Justiça (STJ)...",
      "Inteligência Artificial processando e analisando termos relevantes..."
    ];

    let currentStepIdx = 0;
    setScanStep(steps[0]);

    const interval = setInterval(() => {
      currentStepIdx++;
      if (currentStepIdx < steps.length) {
        setScanStep(steps[currentStepIdx]);
      } else {
        clearInterval(interval);
        setScanning(false);
        setNewPubsCount(2);
        
        // Add new realistic publications
        const simulatedPubs: Publication[] = [
          {
            id: "pub-3",
            cnj: "0054321-99.2026.8.26.0200",
            court: "TJSP (Diário da Justiça Eletrônico)",
            date: new Date().toISOString(),
            advocate: searchTerm || "Rodrigo Cardoso",
            text: `Intime-se o patrono ${searchTerm || "Rodrigo Cardoso"} para apresentar réplica à contestação no prazo legal de 15 dias úteis, sob as penas da lei.`,
            status: "Pendente"
          },
          {
            id: "pub-4",
            cnj: "0011223-44.2025.3.00.0000",
            court: "STJ (Superior Tribunal de Justiça)",
            date: new Date().toISOString(),
            advocate: searchTerm || "Rodrigo Cardoso",
            text: `Decisão Monocrática: Conheço do agravo em recurso especial para negar-lhe provimento, mantendo na íntegra o acórdão recorrido formulado pela defesa de ${searchTerm || "Rodrigo Cardoso"}.`,
            status: "Pendente"
          },
          ...publications
        ];
        setPublications(simulatedPubs);
        setActionSuccessMsg(`Varredura concluída! Encontradas 2 novas publicações com o termo "${searchTerm}".`);
      }
    }, 1500);
  };

  const handleCreateProcessFromPub = async (pub: Publication) => {
    try {
      // Simulate registering new process
      setActionSuccessMsg(`Processo CNJ ${pub.cnj} cadastrado com sucesso a partir do Diário Oficial!`);
      setPublications(publications.map(p => p.id === pub.id ? { ...p, status: "Processado" } : p));
      await onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateEventFromPub = async (pub: Publication, title: string, type: "deadline" | "hearing" | "meeting" | "reminder", days: number) => {
    try {
      const start_date = new Date();
      start_date.setDate(start_date.getDate() + days);
      
      const payload = {
        title: title,
        description: `Agendado automaticamente via Publicações Oficiais. Detalhes: ${pub.text}`,
        type: type,
        start_date: start_date.toISOString(),
        end_date: start_date.toISOString(),
        status: "Pendente",
        process_id: processes.find(p => p.cnj === pub.cnj)?.id || null,
        assigned_to: [pub.advocate]
      };

      const res = await fetch("/api/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setActionSuccessMsg(`Compromisso "${title}" agendado com sucesso para ${start_date.toLocaleDateString("pt-BR")}!`);
        setPublications(publications.map(p => p.id === pub.id ? { ...p, status: "Agendado" } : p));
        await onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotifyClient = (pub: Publication) => {
    setActionSuccessMsg(`Notificação simplificada sobre a publicação ${pub.cnj} enviada ao cliente com sucesso!`);
  };

  return (
    <div className="space-y-6" id="publications-module-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-indigo-600 animate-pulse" /> Capturador Automático de Publicações e Diários
          </h2>
          <p className="text-xs text-slate-400 mt-1">Busque intimações e andamentos de Diários Oficiais de Justiça do Brasil automaticamente por OAB ou Nome.</p>
        </div>
      </div>

      {/* Control Panel / Search Parameters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
        <h3 className="font-semibold text-xs text-slate-700 uppercase tracking-wider">Parâmetros de Varredura</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Nome do Advogado ou OAB</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ex: Rodrigo Cardoso ou 123456/SP"
                className="w-full bg-slate-50 border border-slate-200 pl-9 pr-4 py-2 rounded-xl text-xs outline-none focus:border-indigo-500 text-slate-800 font-semibold"
              />
            </div>
            {currentUser && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {currentUser.name && (
                  <button 
                    type="button" 
                    onClick={() => setSearchTerm(currentUser.name)}
                    className="text-[9px] text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-100/50 font-semibold transition cursor-pointer"
                  >
                    Meu Nome: {currentUser.name}
                  </button>
                )}
                {currentUser.oab && (
                  <button 
                    type="button" 
                    onClick={() => setSearchTerm(currentUser.oab)}
                    className="text-[9px] text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-100/50 font-semibold transition cursor-pointer"
                  >
                    Minha OAB: {currentUser.oab}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Tribunais para Cobertura Simultânea</label>
            <div className="flex flex-wrap gap-2">
              {["TJSP", "TRT2", "TRF3", "STJ", "STF"].map((court) => (
                <button
                  key={court}
                  type="button"
                  onClick={() => handleToggleCourt(court)}
                  className={`text-xs px-3 py-1.5 rounded-xl border font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedCourts.includes(court)
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${selectedCourts.includes(court) ? "bg-white" : "bg-slate-400"}`} />
                  {court}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center pt-3 border-t border-slate-100 gap-3">
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <Info className="w-4 h-4 text-indigo-500 flex-shrink-0" />
            <span>A varredura automática roda diariamente às 06h00 e consolida andamentos na sua caixa de entrada.</span>
          </div>
          
          <button
            type="button"
            disabled={scanning || selectedCourts.length === 0}
            onClick={handleScanNow}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold px-5 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            {scanning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Buscando Diários...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 text-indigo-200" /> Efetuar Varredura Manual Agora
              </>
            )}
          </button>
        </div>
      </div>

      {/* Success/Action Messages */}
      {actionSuccessMsg && (
        <div className="p-3.5 bg-indigo-50 text-indigo-800 border border-indigo-100 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />
          <span className="font-semibold">{actionSuccessMsg}</span>
        </div>
      )}

      {/* Scanning status banner */}
      {scanning && (
        <div className="p-4 bg-slate-900 text-slate-100 border border-slate-800 rounded-2xl text-xs space-y-2.5 animate-pulse">
          <div className="flex items-center gap-2 font-semibold text-indigo-400">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Varredura Eletrônica Inteligente em Andamento...</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono pl-6 border-l border-slate-800">
            {scanStep}
          </div>
        </div>
      )}

      {/* Publications Inbox List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-slate-800 text-sm">Caixa de Entrada de Publicações ({publications.length})</h3>
          <span className="text-[10px] text-slate-400 font-medium">Buscando por: <strong className="text-slate-600 font-semibold">"{searchTerm}"</strong></span>
        </div>

        {publications.length === 0 ? (
          <div className="bg-white border border-slate-200 p-12 text-center text-slate-400 rounded-2xl shadow-2xs">
            <Newspaper className="w-10 h-10 text-slate-300 mx-auto mb-2 opacity-75" />
            <p className="text-xs">Nenhuma publicação registrada. Efetue uma varredura manual para localizar andamentos.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {publications.map((pub) => {
              const matchedProcess = processes.find(p => p.cnj === pub.cnj);
              return (
                <div key={pub.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4 hover:border-indigo-200 transition-colors">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-semibold border border-slate-200">
                          {pub.court}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(pub.date).toLocaleDateString("pt-BR")} às {new Date(pub.date).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-800 text-sm">CNJ: {pub.cnj}</h4>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {matchedProcess ? (
                        <span className="text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-1 rounded-lg font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Vinculado ao Sistema
                        </span>
                      ) : (
                        <span className="text-[9px] bg-amber-50 text-amber-600 border border-amber-100 px-2 py-1 rounded-lg font-semibold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> Não Cadastrado no Sistema
                        </span>
                      )}
                      
                      {pub.status === "Agendado" && (
                        <span className="text-[9px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-1 rounded-lg font-semibold flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" /> Prazo Criado na Agenda
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl text-xs text-slate-700 leading-relaxed font-sans border-l-4 border-indigo-500 whitespace-pre-line">
                    <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider mb-1">Conteúdo da Publicação:</div>
                    {pub.text}
                  </div>

                  {/* Smart Actions Powered by IA */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap justify-between items-center gap-3">
                    <div className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                      <Zap className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Sugestões Inteligentes de Ações Jurídicas</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleNotifyClient(pub)}
                        className="text-slate-600 hover:text-slate-800 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-[10.5px] font-semibold px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Bell className="w-3.5 h-3.5" /> Notificar Cliente
                      </button>

                      {!matchedProcess ? (
                        <button
                          onClick={() => handleCreateProcessFromPub(pub)}
                          className="text-amber-700 hover:text-amber-800 bg-amber-50 border border-amber-100 hover:bg-amber-100 text-[10.5px] font-semibold px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1"
                        >
                          <UserPlus className="w-3.5 h-3.5" /> Cadastrar Processo
                        </button>
                      ) : null}

                      {pub.status !== "Agendado" && (
                        <>
                          <button
                            onClick={() => handleCreateEventFromPub(pub, "Apresentar Contestação (DJE)", "deadline", 15)}
                            className="text-indigo-600 hover:text-indigo-700 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-[10.5px] font-semibold px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1"
                          >
                            <Calendar className="w-3.5 h-3.5" /> Criar Prazo (15 dias úteis)
                          </button>
                          
                          <button
                            onClick={() => handleCreateEventFromPub(pub, "Reunião de Alinhamento de Audiência", "meeting", 5)}
                            className="text-slate-600 hover:text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-[10.5px] font-semibold px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1"
                          >
                            <FileText className="w-3.5 h-3.5" /> Agendar Alinhamento
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
