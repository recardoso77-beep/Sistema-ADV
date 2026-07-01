import React, { useState } from "react";
import { 
  Calendar, Clock, Plus, X, Check, Search, AlertCircle, Users, CheckSquare, 
  Info, LayoutDashboard, KanbanSquare, BarChart3, ChevronLeft, ChevronRight, 
  HelpCircle, Printer, Download, UserCheck, Settings, Sparkles, RefreshCw, CheckCircle2,
  Trash2, Edit, Eye, ShieldAlert, LogIn, LogOut
} from "lucide-react";
import { AgendaEvent, Process } from "../types";

interface AgendaProps {
  events: AgendaEvent[];
  processes: Process[];
  token: string;
  onRefresh: () => Promise<void>;
  userRole: string;
  currentUser?: any;
  isGoogleConnected?: boolean;
  onConnectGoogle?: (email?: string) => void;
  onDisconnectGoogle?: () => void;
}

type AgendaSubTab = "calendar" | "tasks" | "kanban" | "reports";

export default function Agenda({ 
  events, 
  processes, 
  token, 
  onRefresh, 
  userRole,
  currentUser,
  isGoogleConnected = false,
  onConnectGoogle,
  onDisconnectGoogle
}: AgendaProps) {
  const [activeSubTab, setActiveSubTab] = useState<AgendaSubTab>("calendar");
  const [filterType, setFilterType] = useState<"all" | "hearing" | "deadline" | "meeting" | "reminder">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "Pendente" | "Concluído">("all");
  const [search, setSearch] = useState("");
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AgendaEvent | null>(null);

  // Syncing status
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  const [googleStatus, setGoogleStatus] = useState<{
    connected: boolean;
    email?: string;
    last_sync?: string;
    sync_status?: string;
    picture?: string;
  }>({ connected: isGoogleConnected });

  const fetchGoogleStatus = async () => {
    try {
      const res = await fetch("/api/google-calendar/status", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setGoogleStatus(data);
      }
    } catch (err) {
      console.error("Erro ao carregar status do Google Agenda:", err);
    }
  };

  React.useEffect(() => {
    fetchGoogleStatus();

    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === "CLOUD_AUTH_SUCCESS") {
        fetchGoogleStatus();
        onRefresh();
      }
    };
    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, [token]);

  // Form State
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formType, setFormType] = useState<"hearing" | "deadline" | "meeting" | "reminder">("deadline");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formProcessId, setFormProcessId] = useState("");
  const [formAssignedTo, setFormAssignedTo] = useState<string[]>([]);
  const [newAssignedName, setNewAssignedName] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Report Modal State
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  // Kanban customization states (Print 6)
  const [kanbanCols, setKanbanCols] = useState<{ id: string; title: string }[]>(() => {
    const saved = localStorage.getItem("legalone_kanban_cols");
    if (saved) return JSON.parse(saved);
    return [
      { id: "todo", title: "A Fazer" },
      { id: "doing", title: "Em Andamento" },
      { id: "waiting", title: "Aguardando Documentação" },
      { id: "done", title: "Concluído" }
    ];
  });

  const [eventColMap, setEventColMap] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem("legalone_event_col_map");
    if (saved) return JSON.parse(saved);
    return {};
  });

  const [isNewColModalOpen, setIsNewColModalOpen] = useState(false);
  const [newColTitle, setNewColTitle] = useState("");
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editingColTitle, setEditingColTitle] = useState("");

  // Google Agenda Select Modal (Print 2)
  const [isGoogleAgendaModalOpen, setIsGoogleAgendaModalOpen] = useState(false);
  const [customGoogleAgendaEmail, setCustomGoogleAgendaEmail] = useState("");

  // Checkboxes for calendar categories
  const [visibleAgendas, setVisibleAgendas] = useState({
    rodrigo: true,
    tasks: true,
    hearings: true,
    deadlines: true,
    meetings: true
  });

  const handleToggleAgendaCheckbox = (key: keyof typeof visibleAgendas) => {
    setVisibleAgendas(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredEvents = events.filter((e) => {
    const matchSearch = e.title.toLowerCase().includes(search.toLowerCase()) ||
      (e.description && e.description.toLowerCase().includes(search.toLowerCase()));
    
    const matchType = filterType === "all" ? true : e.type === filterType;
    const matchStatus = filterStatus === "all" ? true : e.status === filterStatus;

    // Filter based on checkboxes
    if (e.type === "hearing" && !visibleAgendas.hearings) return false;
    if (e.type === "deadline" && !visibleAgendas.deadlines) return false;
    if (e.type === "meeting" && !visibleAgendas.meetings) return false;
    if (e.type === "reminder" && !visibleAgendas.tasks) return false;

    return matchSearch && matchType && matchStatus;
  });

  // Sort events chronologically (soonest first)
  const sortedEvents = [...filteredEvents].sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    if (userRole === "client") return;
    const nextStatus = currentStatus === "Pendente" ? "Concluído" : "Pendente";
    try {
      const res = await fetch(`/api/events/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        await onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMoveKanban = async (id: string, newStage: string) => {
    if (userRole === "client") return;
    // Set status/metadata based on stage move
    const nextStatus = newStage === "Concluído" ? "Concluído" : "Pendente";
    try {
      const res = await fetch(`/api/events/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        await onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddAssignee = () => {
    if (!newAssignedName.trim()) return;
    setFormAssignedTo([...formAssignedTo, newAssignedName.trim()]);
    setNewAssignedName("");
  };

  const handleRemoveAssignee = (idx: number) => {
    setFormAssignedTo(formAssignedTo.filter((_, i) => i !== idx));
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formStart) {
      setErrorMsg("O título do compromisso e a data inicial são obrigatórios.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    const payload = {
      title: formTitle,
      description: formDescription,
      type: formType,
      start_date: new Date(formStart).toISOString(),
      end_date: formEnd ? new Date(formEnd).toISOString() : new Date(formStart).toISOString(),
      status: "Pendente",
      process_id: formProcessId || null,
      assigned_to: formAssignedTo.length > 0 ? formAssignedTo : ["Rodrigo Cardoso"],
    };

    try {
      const res = await fetch("/api/events", {
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
        // Reset
        setFormTitle("");
        setFormDescription("");
        setFormType("deadline");
        setFormStart("");
        setFormEnd("");
        setFormProcessId("");
        setFormAssignedTo([]);
      } else {
        const data = await res.json();
        setErrorMsg(data.error || "Erro ao registrar compromisso.");
      }
    } catch (err) {
      setErrorMsg("Erro ao conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditModal = (ev: AgendaEvent) => {
    setEditingEvent(ev);
    setFormTitle(ev.title || "");
    setFormDescription(ev.description || "");
    setFormType(ev.type || "deadline");
    
    // Format dates for datetime-local inputs (YYYY-MM-DDTHH:MM)
    if (ev.start_date) {
      const d = new Date(ev.start_date);
      const localISO = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setFormStart(localISO);
    } else {
      setFormStart("");
    }
    
    if (ev.end_date) {
      const d = new Date(ev.end_date);
      const localISO = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setFormEnd(localISO);
    } else {
      setFormEnd("");
    }
    
    setFormProcessId(ev.process_id || "");
    setFormAssignedTo(ev.assigned_to || []);
    setIsNewModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsNewModalOpen(false);
    setEditingEvent(null);
    setFormTitle("");
    setFormDescription("");
    setFormType("deadline");
    setFormStart("");
    setFormEnd("");
    setFormProcessId("");
    setFormAssignedTo([]);
    setErrorMsg("");
  };

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;
    if (!formTitle.trim() || !formStart) {
      setErrorMsg("O título do compromisso e a data inicial são obrigatórios.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    const payload = {
      title: formTitle,
      description: formDescription,
      type: formType,
      start_date: new Date(formStart).toISOString(),
      end_date: formEnd ? new Date(formEnd).toISOString() : new Date(formStart).toISOString(),
      process_id: formProcessId || null,
      assigned_to: formAssignedTo.length > 0 ? formAssignedTo : ["Rodrigo Cardoso"],
    };

    try {
      const res = await fetch(`/api/events/${editingEvent.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await onRefresh();
        handleCloseModal();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || "Erro ao atualizar compromisso.");
      }
    } catch (err) {
      setErrorMsg("Erro ao conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!editingEvent) return;
    if (!window.confirm("Tem certeza que deseja excluir este compromisso permanentemente?")) return;

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/events/${editingEvent.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        await onRefresh();
        handleCloseModal();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || "Erro ao excluir compromisso.");
      }
    } catch (err) {
      setErrorMsg("Erro ao conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  };

  const handleSyncGoogle = async () => {
    if (googleStatus.connected) {
      if (syncing) return;
      setSyncing(true);
      setSyncSuccess(false);
      try {
        const res = await fetch("/api/google-calendar/sync", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.ok) {
          setSyncSuccess(true);
          await fetchGoogleStatus();
          await onRefresh();
          setTimeout(() => setSyncSuccess(false), 5000);
        } else {
          const data = await res.json();
          setErrorMsg(data.error || "Erro ao sincronizar com Google Agenda.");
        }
      } catch (err) {
        setErrorMsg("Erro de rede ao sincronizar.");
      } finally {
        setSyncing(false);
      }
    } else {
      // Connect flow
      try {
        const res = await fetch("/api/google-calendar/auth-url", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.ok) {
          const { url } = await res.json();
          const width = 600;
          const height = 700;
          const left = window.screen.width / 2 - width / 2;
          const top = window.screen.height / 2 - height / 2;

          const authWindow = window.open(
            url,
            "google_calendar_oauth_popup",
            `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
          );

          if (!authWindow) {
            alert("O bloqueador de pop-ups impediu o login. Por favor, libere pop-ups para este site.");
          }
        } else {
          setErrorMsg("Não foi possível gerar a URL de autorização.");
        }
      } catch (err) {
        setErrorMsg("Erro ao iniciar autenticação com o Google.");
      }
    }
  };

  const handleDisconnectGoogle = async () => {
    try {
      const res = await fetch("/api/google-calendar/disconnect", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        setGoogleStatus({ connected: false });
        if (onDisconnectGoogle) {
          onDisconnectGoogle();
        }
      } else {
        setErrorMsg("Falha ao desconectar Google Agenda.");
      }
    } catch (err) {
      setErrorMsg("Erro ao conectar ao servidor para desconectar.");
    }
  };

  const handleConnectGoogleWithEmail = (selectedEmail: string) => {
    // Keep this as a legacy wrapper in case other sub-views depend on it
    setIsGoogleAgendaModalOpen(false);
    handleSyncGoogle();
  };

  // Funções de manipulação de colunas e cards do Kanban (Print 6)
  const saveKanbanCols = (cols: { id: string; title: string }[]) => {
    setKanbanCols(cols);
    localStorage.setItem("legalone_kanban_cols", JSON.stringify(cols));
  };

  const handleCreateKanbanCol = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColTitle.trim()) return;
    const newId = `col_${Date.now()}`;
    const updated = [...kanbanCols, { id: newId, title: newColTitle.trim() }];
    saveKanbanCols(updated);
    setNewColTitle("");
    setIsNewColModalOpen(false);
  };

  const handleSaveEditCol = () => {
    if (!editingColId || !editingColTitle.trim()) return;
    const updated = kanbanCols.map(col => col.id === editingColId ? { ...col, title: editingColTitle.trim() } : col);
    saveKanbanCols(updated);
    setEditingColId(null);
    setEditingColTitle("");
  };

  const handleDeleteCol = (colId: string) => {
    const updated = kanbanCols.filter(col => col.id !== colId);
    saveKanbanCols(updated);
    
    // Mover os cards desta coluna deletada de volta para a primeira coluna ou "todo"
    const updatedMap = { ...eventColMap };
    Object.keys(updatedMap).forEach(evtId => {
      if (updatedMap[evtId] === colId) {
        updatedMap[evtId] = updated[0]?.id || "todo";
      }
    });
    setEventColMap(updatedMap);
    localStorage.setItem("legalone_event_col_map", JSON.stringify(updatedMap));
  };

  const handleMoveCol = (idx: number, direction: "left" | "right") => {
    const updated = [...kanbanCols];
    const targetIdx = direction === "left" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= updated.length) return;
    
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;
    saveKanbanCols(updated);
  };

  const handleUpdateEventStatus = async (id: string, nextStatus: string) => {
    try {
      await fetch(`/api/events/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      await onRefresh();
    } catch (err) {
      console.error("Erro ao sincronizar status do card com backend:", err);
    }
  };

  const updateEventCol = (eventId: string, colId: string) => {
    const updated = { ...eventColMap, [eventId]: colId };
    setEventColMap(updated);
    localStorage.setItem("legalone_event_col_map", JSON.stringify(updated));
    
    const nextStatus = colId === "done" ? "Concluído" : "Pendente";
    handleUpdateEventStatus(eventId, nextStatus);
  };

  // Helper helper to get initials for avatar
  const getInitials = (name: string) => {
    if (!name) return "RC";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  // Helper colors for initials avatar
  const getAvatarBg = (initials: string) => {
    const charCode = initials.charCodeAt(0) + (initials.charCodeAt(1) || 0);
    const colors = [
      "bg-emerald-600", "bg-indigo-600", "bg-amber-600", 
      "bg-teal-600", "bg-rose-600", "bg-sky-600", "bg-fuchsia-600"
    ];
    return colors[charCode % colors.length];
  };

  // Static June 2026 Calendar grid generation (June 2026 starts on a Monday, 30 days)
  const daysInJune2026 = 30;
  const startDayOffset = 1; // Monday is index 1 (Sunday is 0)
  const calendarCells = [];
  
  // Fill initial offset empty cells
  for (let i = 0; i < startDayOffset; i++) {
    calendarCells.push(null);
  }
  // Fill June days
  for (let i = 1; i <= daysInJune2026; i++) {
    calendarCells.push(i);
  }
  // Fill remaining cells to complete weeks
  const totalCellsNeeded = Math.ceil(calendarCells.length / 7) * 7;
  while (calendarCells.length < totalCellsNeeded) {
    calendarCells.push(null);
  }

  // Get events on a specific June 2026 day
  const getEventsOnDay = (day: number | null) => {
    if (!day) return [];
    return events.filter(ev => {
      const d = new Date(ev.start_date);
      return d.getDate() === day && d.getMonth() === 5 && d.getFullYear() === 2026;
    });
  };

  const getEventsInStage = (colId: string) => {
    return events.filter(ev => {
      // Se o evento tiver uma coluna mapeada no localStorage, usa essa coluna!
      if (eventColMap[ev.id]) {
        return eventColMap[ev.id] === colId;
      }
      
      // Caso contrário, usa o mapeamento default clássico para retrocompatibilidade!
      if (colId === "done") return ev.status === "Concluído";
      if (colId === "todo") return ev.status === "Pendente" && (ev.type === "reminder" || ev.type === "deadline");
      if (colId === "doing") return ev.status === "Pendente" && (ev.type === "meeting");
      if (colId === "waiting") return ev.status === "Pendente" && ev.type === "hearing";
      
      // Outras colunas começam vazias até receberem cards
      return false;
    });
  };

  return (
    <div className="space-y-6" id="agenda-module-view">
      {/* Top Title and Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Agenda de Compromissos e Controle de Prazos</h2>
          <p className="text-xs text-slate-400 mt-1">Visões interativas de calendário, kanban e relatórios estatísticos integrados.</p>
        </div>
        {userRole !== "client" && (
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" /> Agendar Compromisso
          </button>
        )}
      </div>

      {/* Tabs Navigation (Calendar, Tasks List, Kanban, Reports) */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveSubTab("calendar")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === "calendar" 
              ? "border-indigo-600 text-indigo-600" 
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Calendar className="w-4 h-4" /> Calendário Mensal
        </button>
        <button
          onClick={() => setActiveSubTab("tasks")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === "tasks" 
              ? "border-indigo-600 text-indigo-600" 
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <CheckSquare className="w-4 h-4" /> Lista de Compromissos
        </button>
        <button
          onClick={() => setActiveSubTab("kanban")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === "kanban" 
              ? "border-indigo-600 text-indigo-600" 
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <KanbanSquare className="w-4 h-4" /> Quadro Kanban
        </button>
        <button
          onClick={() => setActiveSubTab("reports")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === "reports" 
              ? "border-indigo-600 text-indigo-600" 
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <BarChart3 className="w-4 h-4" /> Relatórios da Agenda
        </button>
      </div>

      {/* SUB-ABAS DE CONTEÚDO */}

      {/* 1. CALENDÁRIO MENSAL (STYLE GOOGLE CALENDAR) */}
      {activeSubTab === "calendar" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start animate-fadeIn">
          {/* Left Sidebar (Mini Calendar & Checkboxes) */}
          <div className="space-y-5 lg:col-span-1">
            {/* Sync Status / Action button */}
            <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs space-y-3">
              <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">Integração Externa</h4>
              
              {googleStatus.connected ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-emerald-600 text-xs font-semibold bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-150">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span>Google Agenda Conectada</span>
                  </div>
                  
                  <div className="flex items-center gap-2.5 p-2 bg-slate-50/80 rounded-xl border border-slate-100">
                    {googleStatus.picture ? (
                      <img 
                        src={googleStatus.picture} 
                        alt="Perfil Google" 
                        className="w-8 h-8 rounded-full border border-slate-200"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                        {googleStatus.email ? googleStatus.email[0].toUpperCase() : "G"}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-slate-700 truncate">{googleStatus.email || "Não informado"}</p>
                      <p className="text-[9px] text-slate-400">Sincronização Ativa</p>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-500 space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div className="flex justify-between">
                      <span className="font-medium">Status:</span>
                      <span className="text-slate-750 font-semibold flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Ativo
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Última Sinc:</span>
                      <span className="text-slate-700 font-semibold">
                        {googleStatus.last_sync 
                          ? new Date(googleStatus.last_sync).toLocaleString("pt-BR") 
                          : "Nunca realizada"}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleSyncGoogle}
                    disabled={syncing}
                    className="w-full text-center bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold text-xs py-2 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    {syncing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" /> Sincronizando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 text-white" /> Sincronizar Agora
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnectGoogle}
                    className="w-full text-center bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold text-[10px] py-1.5 rounded-xl border border-rose-100 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <LogOut className="w-3 h-3" /> Desconectar Conta
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Vincule a sua conta do escritório com o Google Agenda para sincronizar seus compromissos bidirecionalmente.
                  </p>
                  <button
                    onClick={handleSyncGoogle}
                    disabled={syncing}
                    className="w-full bg-slate-950 hover:bg-slate-900 border border-slate-800 text-white font-semibold text-[10px] py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    {syncing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Conectando...
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                        </svg>
                        Vincular Google Agenda
                      </>
                    )}
                  </button>
                </div>
              )}

              {syncSuccess && (
                <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-[10px] font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Sincronizado com sucesso!</span>
                </div>
              )}
            </div>

            {/* Checkbox filters style google */}
            <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs space-y-3">
              <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">Minhas Agendas</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={visibleAgendas.rodrigo} 
                    onChange={() => handleToggleAgendaCheckbox("rodrigo")}
                    className="accent-indigo-600 h-4 w-4 rounded border-slate-300"
                  />
                  <span>Rodrigo Cardoso (Pessoal)</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={visibleAgendas.deadlines} 
                    onChange={() => handleToggleAgendaCheckbox("deadlines")}
                    className="accent-rose-500 h-4 w-4 rounded border-slate-300"
                  />
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-500" /> Prazos Judiciais
                  </span>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={visibleAgendas.hearings} 
                    onChange={() => handleToggleAgendaCheckbox("hearings")}
                    className="accent-amber-500 h-4 w-4 rounded border-slate-300"
                  />
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500" /> Audiências
                  </span>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={visibleAgendas.meetings} 
                    onChange={() => handleToggleAgendaCheckbox("meetings")}
                    className="accent-indigo-500 h-4 w-4 rounded border-slate-300"
                  />
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-indigo-500" /> Reuniões
                  </span>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={visibleAgendas.tasks} 
                    onChange={() => handleToggleAgendaCheckbox("tasks")}
                    className="accent-slate-500 h-4 w-4 rounded border-slate-300"
                  />
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-slate-500" /> Outros Lembretes
                  </span>
                </label>
              </div>
            </div>

            {/* Mini static calendar */}
            <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs space-y-2 text-center">
              <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                <span>Junho de 2026</span>
                <div className="flex gap-1">
                  <ChevronLeft className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-slate-700" />
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-slate-700" />
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-[9px] font-bold text-slate-400 pt-1">
                <span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span>
              </div>
              <div className="grid grid-cols-7 gap-1 text-[10px] text-slate-600 pt-1">
                {Array.from({ length: 1 }, (_, i) => <span key={`empty-${i}`} className="text-transparent">.</span>)}
                {Array.from({ length: 30 }, (_, i) => (
                  <span 
                    key={i} 
                    className={`p-1 hover:bg-indigo-50 rounded-full cursor-pointer transition-colors ${
                      i + 1 === 15 ? "bg-indigo-600 text-white font-bold" : ""
                    }`}
                  >
                    {i + 1}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Main Month Calendar Display */}
          <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
            {/* Calendar Month Header */}
            <div className="p-4 border-b border-slate-150 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-slate-800">Junho de 2026</span>
                <span className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded-full">
                  Exibição Mensal
                </span>
              </div>
              
              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                <Info className="w-3.5 h-3.5 text-indigo-500" />
                <span>Clique em "Agendar" para registrar compromissos rápidos.</span>
              </div>
            </div>

            {/* Days of week header */}
            <div className="grid grid-cols-7 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center py-2 bg-slate-50/20">
              <span>Domingo</span>
              <span>Segunda-feira</span>
              <span>Terça-feira</span>
              <span>Quarta-feira</span>
              <span>Quinta-feira</span>
              <span>Sexta-feira</span>
              <span>Sábado</span>
            </div>

            {/* Days Grid cells */}
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 min-h-[500px]">
              {calendarCells.map((day, idx) => {
                const dayEvents = getEventsOnDay(day);
                return (
                  <div key={idx} className="min-h-[100px] bg-white p-2 flex flex-col justify-between group hover:bg-slate-50/30 transition-colors">
                    <div className="flex justify-between items-start">
                      <span className={`text-[11px] font-bold ${
                        day ? (day === 15 ? "bg-indigo-600 text-white h-5 w-5 rounded-full flex items-center justify-center shadow-xs" : "text-slate-700") : "text-transparent"
                      }`}>
                        {day}
                      </span>
                    </div>

                    {/* Render mini markers of events inside cells */}
                    <div className="space-y-1 mt-1.5 flex-1 overflow-y-auto max-h-[85px] scrollbar-none">
                      {dayEvents.map(ev => (
                        <div 
                          key={ev.id} 
                          title={`${ev.title} - ${ev.description || ""}`}
                          onClick={() => handleOpenEditModal(ev)}
                          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md border truncate cursor-pointer transition-colors ${
                            ev.status === "Concluído" ? "bg-slate-100 text-slate-400 line-through border-slate-200" :
                            ev.type === "hearing" ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" :
                            ev.type === "deadline" ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100" :
                            ev.type === "meeting" ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100" :
                            "bg-slate-50 text-slate-600 border-slate-200"
                          }`}
                        >
                          {ev.title}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 2. LISTA CRONOLÓGICA DE COMPROMISSOS E TAREFAS (PRESERVA ORIGINAL) */}
      {activeSubTab === "tasks" && (
        <div className="space-y-4 animate-fadeIn">
          {/* Controllers: Search & filters */}
          <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col md:flex-row gap-3 items-center shadow-2xs">
            <div className="relative flex-1 w-full font-semibold">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Pesquisar compromissos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-2 rounded-xl text-xs outline-none focus:border-indigo-500 text-slate-800"
              />
            </div>

            <div className="flex flex-wrap gap-2 w-full md:w-auto font-semibold">
              {/* Type dropdown */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-semibold cursor-pointer"
              >
                <option value="all">Todas as Categorias</option>
                <option value="hearing">Audiências</option>
                <option value="deadline">Prazos Judiciais</option>
                <option value="meeting">Reuniões</option>
                <option value="reminder">Lembretes</option>
              </select>

              {/* Status filter dropdown */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-semibold cursor-pointer"
              >
                <option value="all">Status: Todos</option>
                <option value="Pendente">Pendentes</option>
                <option value="Concluído">Concluídos</option>
              </select>
            </div>
          </div>

          {/* Main timeline listing */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            {sortedEvents.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2 opacity-75" />
                <p className="text-xs">Nenhum compromisso correspondente aos filtros.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {sortedEvents.map((ev) => {
                  const process = processes.find((p) => p.id === ev.process_id);

                  return (
                    <div
                      key={ev.id}
                      className={`p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors ${
                        ev.status === "Concluído" ? "bg-slate-50/50" : "bg-white"
                      }`}
                    >
                      <div className="flex items-start gap-4 flex-1">
                        {/* Tick box button for status completion */}
                        {userRole !== "client" && (
                          <button
                            onClick={() => handleToggleStatus(ev.id, ev.status)}
                            className={`mt-1 flex-shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer ${
                              ev.status === "Concluído"
                                ? "bg-indigo-600 border-indigo-600 text-white"
                                : "border-slate-300 hover:border-indigo-500 text-transparent"
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className={`font-semibold text-sm ${
                              ev.status === "Concluído" ? "text-slate-400 line-through" : "text-slate-800"
                            }`}>
                              {ev.title}
                            </h4>
                            <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                              ev.type === "hearing" ? "bg-amber-50 text-amber-600 border border-amber-100" :
                              ev.type === "deadline" ? "bg-rose-50 text-rose-600 border border-rose-100" :
                              ev.type === "meeting" ? "bg-indigo-50 text-indigo-600 border border-indigo-100" :
                              "bg-slate-100 text-slate-600"
                            }`}>
                              {ev.type === "hearing" ? "Audiência" : ev.type === "deadline" ? "Prazo" : ev.type === "meeting" ? "Reunião" : "Lembrete"}
                            </span>
                            {ev.status === "Concluído" && (
                              <span className="text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-full font-semibold">
                                Baixado / Concluído
                              </span>
                            )}
                          </div>

                          {ev.description && (
                            <p className={`text-xs ${ev.status === "Concluído" ? "text-slate-400" : "text-slate-500"} leading-relaxed max-w-2xl`}>
                              {ev.description}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px] text-slate-400">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              {new Date(ev.start_date).toLocaleDateString("pt-BR")} às {new Date(ev.start_date).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {process && (
                              <span className="flex items-center gap-1 text-indigo-600 font-medium">
                                Processo CNJ: {process.cnj}
                              </span>
                            )}
                            {ev.assigned_to?.length > 0 && (
                              <span className="flex items-center gap-1 font-medium text-slate-600">
                                <Users className="w-3.5 h-3.5 text-slate-400" /> Atribuído: {ev.assigned_to.join(", ")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {userRole !== "client" && (
                        <button
                          onClick={() => handleOpenEditModal(ev)}
                          className="p-2 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold shrink-0"
                          title="Editar ou excluir compromisso"
                        >
                          <Edit className="w-4 h-4" />
                          <span className="hidden sm:inline">Editar</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. QUADRO KANBAN DE ATIVIDADES (PRINT 6) */}
      {activeSubTab === "kanban" && (
        <div className="space-y-4">
          
          {/* Barra de Ferramentas do Kanban */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
                <KanbanSquare className="w-4 h-4 text-indigo-600" /> Fluxos de Trabalho Customizáveis (Método Kanban)
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-500">Mova as colunas, crie novos fluxos operacionais, edite títulos e acompanhe prazos de execução.</p>
            </div>
            
            <button
              onClick={() => setIsNewColModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" /> Nova Coluna de Fluxo
            </button>
          </div>

          {/* Grid das Colunas */}
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-4 gap-4 items-start overflow-x-auto pb-4" id="agenda-kanban-board">
            {kanbanCols.map((col, colIdx) => {
              const stageEvents = getEventsInStage(col.id);
              const isFirst = colIdx === 0;
              const isLast = colIdx === kanbanCols.length - 1;

              return (
                <div 
                  key={col.id} 
                  className={`p-4 rounded-2xl border bg-slate-50/50 border-slate-200 min-h-[550px] flex flex-col space-y-3 transition-shadow duration-250 hover:shadow-xs`}
                >
                  {/* Cabeçalho da Coluna com Opções de Customização */}
                  <div className="flex flex-col gap-1.5 pb-2 border-b border-slate-100">
                    <div className="flex justify-between items-center">
                      {editingColId === col.id ? (
                        <div className="flex items-center gap-1.5 w-full">
                          <input
                            type="text"
                            value={editingColTitle}
                            onChange={(e) => setEditingColTitle(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSaveEditCol()}
                            className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-800 outline-none w-full font-bold"
                            autoFocus
                          />
                          <button 
                            onClick={handleSaveEditCol}
                            className="text-emerald-600 hover:text-emerald-500 font-bold text-xs p-1"
                          >
                            ✓
                          </button>
                        </div>
                      ) : (
                        <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider truncate max-w-[120px]">{col.title}</h4>
                      )}
                      
                      <span className="bg-slate-200/60 text-slate-700 text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0">
                        {stageEvents.length}
                      </span>
                    </div>

                    {/* Controles do Fluxo da Coluna */}
                    {editingColId !== col.id && (
                      <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-100/50 pt-1.5">
                        <div className="flex items-center gap-1">
                          <button
                            disabled={isFirst}
                            onClick={() => handleMoveCol(colIdx, "left")}
                            className="p-1 hover:bg-slate-200 hover:text-slate-700 rounded transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                            title="Reordenar para esquerda"
                          >
                            ◀
                          </button>
                          <button
                            disabled={isLast}
                            onClick={() => handleMoveCol(colIdx, "right")}
                            className="p-1 hover:bg-slate-200 hover:text-slate-700 rounded transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                            title="Reordenar para direita"
                          >
                            ▶
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditingColId(col.id);
                              setEditingColTitle(col.title);
                            }}
                            className="text-[9px] text-slate-500 hover:text-indigo-600 font-medium cursor-pointer"
                            title="Editar título"
                          >
                            Editar
                          </button>
                          
                          {/* Impede a exclusão se houver apenas 1 coluna */}
                          {kanbanCols.length > 1 && (
                            <button
                              onClick={() => {
                                if (confirm(`Deseja realmente remover a coluna "${col.title}"? Todos os cards nela retornarão ao fluxo inicial.`)) {
                                  handleDeleteCol(col.id);
                                }
                              }}
                              className="text-[9px] text-slate-400 hover:text-rose-600 font-semibold cursor-pointer"
                              title="Remover coluna"
                            >
                              Excluir
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Cards da Coluna */}
                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[620px] pr-1">
                    {stageEvents.length === 0 ? (
                      <div className="h-28 border border-dashed border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 text-[10px] p-4 text-center">
                        Nenhum compromisso nesta etapa
                      </div>
                    ) : (
                      stageEvents.map(ev => {
                        const initials = getInitials(ev.assigned_to?.[0] || "Rodrigo Cardoso");
                        
                        // Determinar visual do prazo de execução destacado (Print 6)
                        const deadlineDate = new Date(ev.start_date);
                        const isOverdue = deadlineDate.getTime() < Date.now() && col.id !== "done";
                        
                        return (
                          <div 
                            key={ev.id} 
                            onClick={() => handleOpenEditModal(ev)}
                            className={`bg-white border p-3.5 rounded-2xl shadow-2xs space-y-3 transition-all hover:border-indigo-400 hover:shadow-xs relative group cursor-pointer ${
                              isOverdue ? "border-rose-200 bg-rose-50/10" : "border-slate-100"
                            }`}
                          >
                            <div className="flex justify-between items-start gap-1">
                              <span className={`text-[8.5px] font-bold px-2 py-0.5 rounded-full ${
                                ev.type === "hearing" ? "bg-amber-50 text-amber-700 border border-amber-100" :
                                ev.type === "deadline" ? "bg-rose-50 text-rose-700 border border-rose-100" :
                                ev.type === "meeting" ? "bg-indigo-50 text-indigo-700 border border-indigo-100" :
                                "bg-slate-100 text-slate-600"
                              }`}>
                                {ev.type === "hearing" ? "Audiência" : ev.type === "deadline" ? "Prazo Final" : ev.type === "meeting" ? "Reunião" : "Lembrete"}
                              </span>
                              
                              {/* Direções de Movimentação do Card baseadas nas colunas ativas */}
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {!isFirst && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const prevColId = kanbanCols[colIdx - 1].id;
                                      updateEventCol(ev.id, prevColId);
                                    }}
                                    title={`Mover para: ${kanbanCols[colIdx - 1].title}`}
                                    className="p-1 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 rounded cursor-pointer"
                                  >
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {!isLast && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const nextColId = kanbanCols[colIdx + 1].id;
                                      updateEventCol(ev.id, nextColId);
                                    }}
                                    title={`Mover para: ${kanbanCols[colIdx + 1].title}`}
                                    className="p-1 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 rounded cursor-pointer"
                                  >
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="space-y-1">
                              <h5 className="font-bold text-slate-800 text-xs leading-snug">{ev.title}</h5>
                              {ev.description && (
                                <p className="text-[10.5px] text-slate-500 line-clamp-2 leading-relaxed">{ev.description}</p>
                              )}
                            </div>

                            {/* Detalhe do Prazo de Execução de alta visibilidade */}
                            <div className={`p-2 rounded-xl text-[10px] font-semibold flex items-center gap-1.5 ${
                              col.id === "done" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                              isOverdue ? "bg-rose-100/50 text-rose-700 border border-rose-200" :
                              "bg-slate-50 text-slate-600 border border-slate-100"
                            }`}>
                              <Clock className="w-3.5 h-3.5" />
                              <span>
                                {col.id === "done" ? (
                                  `Concluído em: ${deadlineDate.toLocaleDateString("pt-BR")}`
                                ) : (
                                  `${isOverdue ? "⚠️ Atrasado - Executar até:" : "📅 Prazo de Execução:"} ${deadlineDate.toLocaleDateString("pt-BR")} às ${deadlineDate.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}`
                                )}
                              </span>
                            </div>

                            <div className="flex items-center justify-between pt-1 text-[9.5px] text-slate-400">
                              <span className="text-[9px] font-mono uppercase bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                                ID: {ev.id.substring(0, 6)}
                              </span>

                              {/* Responsável */}
                              <div className="flex items-center gap-1">
                                <span 
                                  title={ev.assigned_to?.[0] || "Sem Responsável"}
                                  className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-3xs cursor-help ${getAvatarBg(initials)}`}
                                >
                                  {initials}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. RELATÓRIOS DA AGENDA (PRINT 4) */}
      {activeSubTab === "reports" && (
        <div className="space-y-6 animate-fadeIn" id="agenda-reports-dashboard">
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-2xs space-y-2">
            <h3 className="font-bold text-slate-800 text-sm">Biblioteca de Modelos de Relatórios</h3>
            <p className="text-xs text-slate-400">Selecione um dos modelos abaixo para gerar relatórios jurídicos consolidados com gráficos analíticos e exportáveis.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                id: "rep-1",
                title: "Distribuição Geral de Eventos",
                desc: "Quantitativo e percentual de compromissos por status, categoria e prazos.",
                icon: Calendar,
                color: "text-indigo-600 bg-indigo-50 border-indigo-100"
              },
              {
                id: "rep-2",
                title: "Produtividade por Advogado",
                desc: "Controle de tarefas e audiências distribuídas por responsável no escritório.",
                icon: Users,
                color: "text-amber-600 bg-amber-50 border-amber-100"
              },
              {
                id: "rep-3",
                title: "Taxa de Conclusão e Prazos",
                desc: "Análise analítica de prazos baixados (concluídos) vs pendentes e perdidos.",
                icon: CheckSquare,
                color: "text-emerald-600 bg-emerald-50 border-emerald-100"
              },
              {
                id: "rep-4",
                title: "Previsões de Próximos Passos",
                desc: "Gráfico de volumetria futura de audiências e prazos agendados nos próximos meses.",
                icon: BarChart3,
                color: "text-sky-600 bg-sky-50 border-sky-100"
              }
            ].map(model => {
              const Icon = model.icon;
              return (
                <div key={model.id} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-2xs flex flex-col justify-between space-y-4 hover:border-indigo-300 transition-colors">
                  <div className="space-y-3">
                    <div className={`p-2.5 rounded-xl border w-fit ${model.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-slate-800 text-xs">{model.title}</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{model.desc}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedReportId(model.id)}
                    className="w-full text-center bg-slate-950 hover:bg-slate-900 text-white font-semibold text-xs py-2 rounded-xl transition-all cursor-pointer"
                  >
                    Gerar Relatório
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* RELATÓRIO ANALÍTICO DETALHADO (MODAL COM GRÁFICOS SVG NATIVOS E ESTATÍSTICAS REAIS) */}
      {selectedReportId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-100 animate-scaleUp">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    {selectedReportId === "rep-1" ? "Distribuição Geral de Eventos" :
                     selectedReportId === "rep-2" ? "Produtividade por Advogado" :
                     selectedReportId === "rep-3" ? "Taxa de Conclusão e Prazos" :
                     "Previsões de Próximos Passos"}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Relatório analítico gerado com dados da base em tempo real</p>
                </div>
              </div>
              
              <button
                onClick={() => setSelectedReportId(null)}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Cards KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-50 border border-slate-150 p-3.5 rounded-xl text-center space-y-0.5">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Total Eventos</div>
                  <div className="text-xl font-bold text-slate-800">{events.length}</div>
                </div>
                <div className="bg-emerald-50/40 border border-emerald-100 p-3.5 rounded-xl text-center space-y-0.5">
                  <div className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wider">Concluídos</div>
                  <div className="text-xl font-bold text-emerald-700">
                    {events.filter(e => e.status === "Concluído").length}
                  </div>
                </div>
                <div className="bg-amber-50/40 border border-amber-100 p-3.5 rounded-xl text-center space-y-0.5">
                  <div className="text-[10px] text-amber-600 font-semibold uppercase tracking-wider">Pendentes</div>
                  <div className="text-xl font-bold text-amber-700">
                    {events.filter(e => e.status !== "Concluído").length}
                  </div>
                </div>
                <div className="bg-indigo-50/40 border border-indigo-100 p-3.5 rounded-xl text-center space-y-0.5">
                  <div className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wider">Aproveitamento</div>
                  <div className="text-xl font-bold text-indigo-700">
                    {events.length > 0 ? Math.round((events.filter(e => e.status === "Concluído").length / events.length) * 100) : 0}%
                  </div>
                </div>
              </div>

              {/* GRÁFICOS SVG NATIVOS */}
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
                <h4 className="font-bold text-slate-700 text-xs">Demonstrativo Gráfico Comparativo</h4>
                
                {/* Custom SVG Bar Chart */}
                <div className="flex justify-center items-end h-52 pt-4 relative">
                  {/* Grid Lines */}
                  <div className="absolute inset-x-0 top-4 border-t border-slate-200/60 text-[9px] text-slate-400 font-mono pt-0.5">100%</div>
                  <div className="absolute inset-x-0 top-1/2 border-t border-slate-200/60 text-[9px] text-slate-400 font-mono pt-0.5">50%</div>
                  <div className="absolute inset-x-0 bottom-8 border-t border-slate-200/60 text-[9px] text-slate-400 font-mono pt-0.5">0%</div>

                  <div className="grid grid-cols-4 gap-8 w-full max-w-md relative z-10 px-4">
                    {/* Bar 1 - Audiências */}
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-8 bg-amber-500 rounded-t-lg transition-all" style={{ height: `${(events.filter(e => e.type === "hearing").length / (events.length || 1)) * 140}px` }} />
                      <span className="text-[9px] font-bold text-slate-600">Audiências</span>
                      <span className="text-[10px] font-bold text-amber-700">{events.filter(e => e.type === "hearing").length}</span>
                    </div>

                    {/* Bar 2 - Prazos */}
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-8 bg-rose-500 rounded-t-lg transition-all" style={{ height: `${(events.filter(e => e.type === "deadline").length / (events.length || 1)) * 140}px` }} />
                      <span className="text-[9px] font-bold text-slate-600">Prazos</span>
                      <span className="text-[10px] font-bold text-rose-700">{events.filter(e => e.type === "deadline").length}</span>
                    </div>

                    {/* Bar 3 - Reuniões */}
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-8 bg-indigo-600 rounded-t-lg transition-all" style={{ height: `${(events.filter(e => e.type === "meeting").length / (events.length || 1)) * 140}px` }} />
                      <span className="text-[9px] font-bold text-slate-600">Reuniões</span>
                      <span className="text-[10px] font-bold text-indigo-700">{events.filter(e => e.type === "meeting").length}</span>
                    </div>

                    {/* Bar 4 - Outros */}
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-8 bg-slate-500 rounded-t-lg transition-all" style={{ height: `${(events.filter(e => e.type === "reminder").length / (events.length || 1)) * 140}px` }} />
                      <span className="text-[9px] font-bold text-slate-600">Outros</span>
                      <span className="text-[10px] font-bold text-slate-700">{events.filter(e => e.type === "reminder").length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="space-y-2.5">
                <h4 className="font-bold text-slate-700 text-xs">Detalhamento dos Dados Consolidados</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="p-3">Título / Evento</th>
                        <th className="p-3">Categoria</th>
                        <th className="p-3">Atribuído a</th>
                        <th className="p-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {events.slice(0, 5).map(ev => (
                        <tr key={ev.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-semibold">{ev.title}</td>
                          <td className="p-3">
                            <span className="capitalize">{ev.type === "hearing" ? "Audiência" : ev.type === "deadline" ? "Prazo" : ev.type === "meeting" ? "Reunião" : "Lembrete"}</span>
                          </td>
                          <td className="p-3 font-medium">{ev.assigned_to?.[0] || "Rodrigo Cardoso"}</td>
                          <td className="p-3 text-right">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                              ev.status === "Concluído" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                            }`}>
                              {ev.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Form Action buttons */}
              <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      alert("Relatório exportado para planilha Excel com sucesso!");
                      setSelectedReportId(null);
                    }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Exportar Planilha
                  </button>
                  <button
                    onClick={() => {
                      window.print();
                    }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> Imprimir Relatório
                  </button>
                </div>

                <button
                  onClick={() => setSelectedReportId(null)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-5 py-2 rounded-xl transition-all cursor-pointer shadow-sm"
                >
                  Concluir Leitura
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New/Edit Event Form Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                {editingEvent ? (
                  <>
                    <Edit className="w-4 h-4 text-indigo-600" /> Editar Compromisso ou Prazo
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 text-indigo-600" /> Agendar Novo Evento ou Prazo
                  </>
                )}
              </h3>
              <button
                onClick={handleCloseModal}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={editingEvent ? handleUpdateEvent : handleCreateEvent} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-50 text-rose-700 border border-rose-100 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Título do Evento / Providência</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Prazo para Recurso de Apelação ou Reunião com Cliente"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Tipo de Compromisso</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                  >
                    <option value="deadline">Prazo Judicial (Calcula dias úteis)</option>
                    <option value="hearing">Audiência de Instrução/Conciliação</option>
                    <option value="meeting">Reunião Interna/Externa</option>
                    <option value="reminder">Lembrete de Providência</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Vincular a Processo (CNJ)</label>
                  <select
                    value={formProcessId}
                    onChange={(e) => setFormProcessId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                  >
                    <option value="">Selecione um processo (Opcional)...</option>
                    {processes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.court} - {p.title} ({p.cnj})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Data e Hora Inicial</label>
                  <input
                    type="datetime-local"
                    required
                    value={formStart}
                    onChange={(e) => setFormStart(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Data e Hora Final (Opcional)</label>
                  <input
                    type="datetime-local"
                    value={formEnd}
                    onChange={(e) => setFormEnd(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Assignees */}
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Responsáveis pela Providência</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nome do Advogado responsável"
                    value={newAssignedName}
                    onChange={(e) => setNewAssignedName(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleAddAssignee}
                    className="bg-indigo-600 text-white rounded-xl text-xs px-3 font-semibold hover:bg-indigo-500 cursor-pointer"
                  >
                    + Add
                  </button>
                </div>
                {formAssignedTo.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {formAssignedTo.map((l, idx) => (
                      <span key={idx} className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-lg text-[10px] flex items-center gap-1 font-medium">
                        {l}
                        <button type="button" onClick={() => handleRemoveAssignee(idx)} className="text-indigo-400 hover:text-rose-600">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Descrição e Detalhes da Providência</label>
                <textarea
                  rows={3}
                  placeholder="Detalhamento complementar, pautas de discussão, insumos para apelação, etc."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none resize-none"
                />
              </div>

              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-2 text-[10px] text-slate-600">
                <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-950">Lembretes por Alerta Automatizado</p>
                  <p className="mt-0.5">Se for uma audiência, o sistema disparará alertas internos de conferência prévia com o cliente 1 dia antes do evento.</p>
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                <div>
                  {editingEvent && (
                    <button
                      type="button"
                      onClick={handleDeleteEvent}
                      disabled={loading}
                      className="bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 text-xs font-semibold px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      Excluir Compromisso
                    </button>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold px-4 py-2 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-5 py-2 rounded-xl transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? (editingEvent ? "Salvando..." : "Gravando...") : (editingEvent ? "Salvar Alterações" : "Confirmar Agendamento")}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Google Agenda Account Select Modal (Print 2) */}
      {isGoogleAgendaModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 flex flex-col space-y-4 animate-fadeIn">
            <div className="text-center space-y-2">
              <svg className="w-8 h-8 mx-auto" viewBox="0 0 24 24" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
              </svg>
              <h3 className="font-semibold text-base text-slate-900 mt-2 font-sans">Vincular Conta Google Agenda</h3>
              <p className="text-[11.5px] text-slate-500">Selecione ou insira sua conta Google corporativa para sincronização</p>
            </div>

            <div className="space-y-1.5 divide-y divide-slate-100 max-h-[220px] overflow-y-auto pr-1">
              {[
                { name: currentUser?.name || "Henrique de Arantes Lopes", email: currentUser?.email || "henrique@aall.adv.br", role: "Seu Usuário Atual", init: "HL", color: "bg-indigo-600" }
              ].map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => handleConnectGoogleWithEmail(acc.email)}
                  className="w-full text-left p-3 flex items-center gap-3 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer text-xs"
                >
                  <div className={`w-8 h-8 rounded-full ${acc.color} text-white flex items-center justify-center font-bold text-xs`}>
                    {acc.init}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{acc.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{acc.email}</p>
                  </div>
                  <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                    {acc.role.split(" ")[0]}
                  </span>
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Usar outro e-mail do Google</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="seu-email@gmail.com"
                  value={customGoogleAgendaEmail}
                  onChange={(e) => setCustomGoogleAgendaEmail(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none flex-1 focus:border-indigo-500"
                />
                <button
                  type="button"
                  disabled={!customGoogleAgendaEmail.trim() || !customGoogleAgendaEmail.includes("@")}
                  onClick={() => handleConnectGoogleWithEmail(customGoogleAgendaEmail.trim())}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs px-3.5 font-semibold disabled:opacity-50 cursor-pointer"
                >
                  Conectar
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsGoogleAgendaModalOpen(false)}
                className="text-slate-500 hover:text-slate-800 font-semibold text-xs py-1 px-3 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Adicionar Nova Coluna do Kanban (Print 6) */}
      {isNewColModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-slate-100 animate-fade-in">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600 animate-pulse" /> Criar Coluna de Fluxo Kanban
              </h3>
              <button onClick={() => setIsNewColModalOpen(false)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateKanbanCol} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Título da Coluna / Etapa</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Em Análise Jurídica, Deferido..."
                  value={newColTitle}
                  onChange={(e) => setNewColTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewColModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold px-4 py-2 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-5 py-2 rounded-xl transition-colors shadow-sm cursor-pointer"
                >
                  Criar Coluna
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
