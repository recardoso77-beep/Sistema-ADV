import React, { useState, useEffect } from "react";
import { Scale, Users, Calendar, FileText, TrendingUp, Zap, ShieldAlert, Sparkles, LogOut, LayoutDashboard, UserCheck, Bot, Menu, X, ArrowUpRight, Copy, CheckCircle2, FileSignature, Database, Newspaper, Cloud, KeyRound, Calculator, BarChart3 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Client, Process, AgendaEvent, FinancialItem, DocumentItem, Workflow, User, LawFirm } from "./types";

// Import modules
import Dashboard from "./components/Dashboard";
import Clients from "./components/Clients";
import Processes from "./components/Processes";
import Agenda from "./components/Agenda";
import Publications from "./components/Publications";
import Documents from "./components/Documents";
import Financial from "./components/Financial";
import Workflows from "./components/Workflows";
import AdminPanel from "./components/AdminPanel";
import AiAssistant from "./components/AiAssistant";
import Calculos from "./components/Calculos";
import ReportsBI from "./components/ReportsBI";

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

export default function App() {
  const [token, setToken] = useState<string>(localStorage.getItem("legalone_token") || "");
  const [user, setUser] = useState<User | null>(null);

  // Core Data State
  const [clients, setClients] = useState<Client[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [finances, setFinances] = useState<FinancialItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [lawFirms, setLawFirms] = useState<LawFirm[]>([]);
  const [selectedLawFirmFilter, setSelectedLawFirmFilter] = useState<string>("all");

  // Calcula o escritório ativo atual de forma reativa para todo o sistema (adotando a identidade visual dele)
  const activeFirm = user ? (lawFirms.find((f) => {
    if (user.law_firm_id) {
      return f.id === user.law_firm_id;
    }
    if (selectedLawFirmFilter !== "all") {
      return f.id === selectedLawFirmFilter;
    }
    return f.id === "1";
  }) || lawFirms.find((f) => f.id === "1") || lawFirms[0]) : null;

  const activeFirmName = activeFirm ? activeFirm.name : "Cardoso & Mendes Advogados";

  const isPrimaryLight = isColorLight(activeFirm?.primary_color || "#4f46e5");
  const isSecondaryLight = isColorLight(activeFirm?.secondary_color || "#111827");

  const headerTextColor = isPrimaryLight ? "text-slate-900" : "text-white";
  const headerMutedTextColor = isPrimaryLight ? "text-slate-600" : "text-slate-300";
  const headerHoverBg = isPrimaryLight ? "hover:bg-slate-200/50" : "hover:bg-white/10";
  const headerBorderColor = isPrimaryLight ? "border-slate-300/60" : "border-white/10";

  const sidebarTextColor = isPrimaryLight ? "text-slate-800" : "text-slate-200/90";
  const sidebarMutedTextColor = isPrimaryLight ? "text-slate-500" : "text-white/50";
  const sidebarHoverBg = isPrimaryLight ? "hover:bg-slate-200/60 hover:text-slate-900" : "hover:bg-white/10 hover:text-white";
  const sidebarActiveBg = "bg-[var(--theme-secondary)]";
  const sidebarActiveTextColor = isSecondaryLight ? "text-slate-900 font-bold" : "text-white font-semibold";

  // Navigation State
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Login Form
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState(localStorage.getItem("google_connected") === "true");
  const [isGoogleSelectModalOpen, setIsGoogleSelectModalOpen] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState("");

  // Profile Edit Modal States
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePassword, setProfilePassword] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");

  // Esqueci a Senha e Redefinição de Senha
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState<string | null>(null);
  const [forgotPasswordError, setForgotPasswordError] = useState<string | null>(null);
  const [forgotPasswordSimulatedLink, setForgotPasswordSimulatedLink] = useState<string | null>(null);

  const [urlResetToken, setUrlResetToken] = useState<string | null>(null);
  const [urlResetEmail, setUrlResetEmail] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState<string | null>(null);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);

  // Portal do Cliente - specifically selected process details
  const [clientProcessSelected, setClientProcessSelected] = useState<any | null>(null);
  const [clientProcessLoading, setClientProcessLoading] = useState(false);

  // Sincronização Geral
  const handleFetchAllData = async (currentToken: string, firmFilter = selectedLawFirmFilter) => {
    if (!currentToken) return;
    try {
      const headers = { Authorization: `Bearer ${currentToken}` };

      // Fetch Profile
      const profileRes = await fetch("/api/auth/me", { headers });
      if (profileRes.ok) {
        const uData = await profileRes.json();
        const userData = uData.user;
        setUser(userData);
        // Default client to process or dashboard tabs
        if (userData.role === "client") {
          setActiveTab("meus-processos");
        }
      } else {
        // Token expired or invalid
        handleLogout();
        return;
      }

      // Parallel data load
      const queryParam = firmFilter !== "all" ? `?law_firm_id=${firmFilter}` : "";
      const [clientsRes, processesRes, eventsRes, financesRes, documentsRes, workflowsRes, usersRes, lawFirmsRes] = await Promise.all([
        fetch(`/api/clients${queryParam}`, { headers }),
        fetch(`/api/processes${queryParam}`, { headers }),
        fetch(`/api/events${queryParam}`, { headers }),
        fetch(`/api/financial${queryParam}`, { headers }),
        fetch(`/api/documents${queryParam}`, { headers }),
        fetch(`/api/workflows${queryParam}`, { headers }),
        fetch(`/api/admin/users${queryParam}`, { headers }).catch(() => null), // might fail for non-admins, catch safely
        fetch("/api/admin/law-firms", { headers }).catch(() => null), // Always load all law firms to populate dropdown
      ]);

      if (clientsRes.ok) setClients(await clientsRes.json());
      if (processesRes.ok) setProcesses(await processesRes.json());
      if (eventsRes.ok) setEvents(await eventsRes.json());
      if (financesRes.ok) setFinances(await financesRes.json());
      if (documentsRes.ok) setDocuments(await documentsRes.json());
      if (workflowsRes.ok) setWorkflows(await workflowsRes.json());
      if (usersRes && usersRes.ok) setUsers(await usersRes.json());
      if (lawFirmsRes && lawFirmsRes.ok) setLawFirms(await lawFirmsRes.json());

    } catch (e) {
      console.error("Erro sincronizando dados do servidor Express:", e);
    }
  };

  useEffect(() => {
    if (token) {
      handleFetchAllData(token, selectedLawFirmFilter);
    }
  }, [token, selectedLawFirmFilter]);

  // Aplica cores do escritório de forma global e reativa para todo o sistema (incluindo modals/portals)
  useEffect(() => {
    if (activeFirm) {
      const primary = activeFirm.primary_color || "#4f46e5";
      const secondary = activeFirm.secondary_color || "#111827";
      document.documentElement.style.setProperty("--theme-primary", primary);
      document.documentElement.style.setProperty("--theme-secondary", secondary);

      // Favicon change
      const faviconUrl = activeFirm.favicon_url || activeFirm.logo_url;
      if (faviconUrl) {
        let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
        if (!link) {
          link = document.createElement("link");
          link.rel = "icon";
          document.head.appendChild(link);
        }
        link.href = faviconUrl;
      }
    } else {
      document.documentElement.style.setProperty("--theme-primary", "#4f46e5");
      document.documentElement.style.setProperty("--theme-secondary", "#111827");
    }
  }, [activeFirm]);

  useEffect(() => {
    if (isProfileModalOpen && user) {
      setProfileName(user.name);
      setProfileEmail(user.email);
      setProfilePassword("");
      setProfileError("");
    }
  }, [isProfileModalOpen, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("legalone_token", data.token);
        setToken(data.token);
      } else {
        setLoginError(data.error || "E-mail ou senha incorretos.");
      }
    } catch (err) {
      setLoginError("Erro ao comunicar com o servidor. Tente novamente.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setIsGoogleSelectModalOpen(true);
  };

  const handleGoogleLoginWithEmail = async (selectedEmail: string) => {
    setIsGoogleSelectModalOpen(false);
    setLoginLoading(true);
    setLoginError("");
    try {
      const res = await fetch("/api/auth/login/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: selectedEmail }),
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("legalone_token", data.token);
        localStorage.setItem("google_connected", "true");
        localStorage.setItem("google_connected_email", selectedEmail);
        setIsGoogleConnected(true);
        setToken(data.token);
      } else {
        setLoginError(data.error || "Erro ao efetuar login com o Google.");
      }
    } catch (err) {
      setLoginError("Erro ao comunicar com o servidor. Tente novamente.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("legalone_token");
    localStorage.removeItem("google_connected");
    setIsGoogleConnected(false);
    setToken("");
    setUser(null);
    setClients([]);
    setProcesses([]);
    setEvents([]);
    setFinances([]);
    setDocuments([]);
    setWorkflows([]);
    setUsers([]);
    setClientProcessSelected(null);
    setActiveTab("dashboard");
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) {
      setProfileError("O nome é obrigatório.");
      return;
    }
    if (!profileEmail.trim()) {
      setProfileError("O e-mail é obrigatório.");
      return;
    }

    setIsSavingProfile(true);
    setProfileError("");

    try {
      const res = await fetch("/api/auth/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: profileName,
          email: profileEmail,
          ...(profilePassword ? { password: profilePassword } : {}),
        }),
      });

      if (res.ok) {
        // Refresh all data to update user profile globally
        await handleFetchAllData(token, selectedLawFirmFilter);
        setIsProfileModalOpen(false);
        alert("Perfil atualizado com sucesso!");
      } else {
        const errData = await res.json();
        setProfileError(errData.error || "Erro ao salvar perfil.");
      }
    } catch (err: any) {
      console.error(err);
      setProfileError("Falha ao comunicar com o servidor.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleQuickLogin = (quickEmail: string) => {
    setEmail(quickEmail);
    setPassword("@Sportix");
  };

  // Detectar token de redefinição de senha na URL ao carregar
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("resetToken");
    const emailParam = params.get("email");
    if (tokenParam && emailParam) {
      setUrlResetToken(tokenParam);
      setUrlResetEmail(emailParam);
    }
  }, []);

  // Solicitar recuperação de senha
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPasswordLoading(true);
    setForgotPasswordError(null);
    setForgotPasswordSuccess(null);
    setForgotPasswordSimulatedLink(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotPasswordEmail }),
      });

      const data = await res.json();
      if (res.ok) {
        setForgotPasswordSuccess(data.message || "E-mail de instruções enviado!");
        if (data.simulated && data.resetLink) {
          setForgotPasswordSimulatedLink(data.resetLink);
        }
      } else {
        setForgotPasswordError(data.error || "E-mail não encontrado ou inativo.");
      }
    } catch (err) {
      setForgotPasswordError("Erro ao solicitar recuperação de senha.");
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  // Redefinir senha de fato
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetPasswordLoading(true);
    setResetPasswordError(null);
    setResetPasswordSuccess(null);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: urlResetEmail,
          token: urlResetToken,
          newPassword
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setResetPasswordSuccess(data.message || "Senha corporativa redefinida!");
        // Limpar os parâmetros da URL
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        // Voltar ao login normal após 3 segundos
        setTimeout(() => {
          setUrlResetToken(null);
          setUrlResetEmail(null);
          setNewPassword("");
          setResetPasswordSuccess(null);
        }, 3500);
      } else {
        setResetPasswordError(data.error || "Erro ao redefinir a senha corporativa.");
      }
    } catch (err) {
      setResetPasswordError("Erro ao comunicar com o servidor.");
    } finally {
      setResetPasswordLoading(false);
    }
  };

  // Client Portal specific handles
  const handleFetchClientProcessDetails = async (id: string) => {
    setClientProcessLoading(true);
    setClientProcessSelected(null);
    try {
      const res = await fetch(`/api/processes/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setClientProcessSelected(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setClientProcessLoading(false);
    }
  };

  const handleSignClientDoc = async (docId: string) => {
    try {
      const res = await fetch(`/api/documents/${docId}/sign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        await handleFetchAllData(token);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Render Login View if not authenticated
  if (!token || !user) {
    // Tela de Redefinição de Senha Corporativa (Quando acessada via link de e-mail/resetToken)
    if (urlResetToken && urlResetEmail) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-indigo-500 selection:text-white" id="auth-reset-screen">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl animate-pulse" />

          <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-md border border-slate-800 p-8 rounded-3xl shadow-2xl relative z-10 space-y-6">
            <div className="text-center space-y-2">
              <div className="h-12 w-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto shadow-lg shadow-indigo-600/20">
                <Scale className="w-6 h-6 animate-spin" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white font-sans mt-3">Redefinir Senha</h1>
              <p className="text-xs text-slate-400">Cadastre sua nova senha corporativa de acesso ao Legal Prime.</p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              {resetPasswordError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>{resetPasswordError}</span>
                </div>
              )}

              {resetPasswordSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                  <span>{resetPasswordSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Endereço de E-mail</label>
                <input
                  type="email"
                  disabled
                  value={urlResetEmail}
                  className="w-full bg-slate-950/50 border border-slate-800 text-slate-400 rounded-xl px-4 py-3 text-xs outline-none cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Nova Senha Corporativa</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                  minLength={6}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-4 py-3 text-xs outline-none focus:border-indigo-500 placeholder-slate-600"
                />
              </div>

              <button
                type="submit"
                disabled={resetPasswordLoading || !!resetPasswordSuccess}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all text-xs cursor-pointer shadow-md shadow-indigo-600/10"
              >
                {resetPasswordLoading ? "Processando..." : "Confirmar Nova Senha"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setUrlResetToken(null);
                  setUrlResetEmail(null);
                  setNewPassword("");
                }}
                className="w-full bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-400 font-semibold py-2.5 rounded-xl transition-all text-xs cursor-pointer"
              >
                Voltar para o Login
              </button>
            </form>
          </div>
        </div>
      );
    }

    // Se não clicou para ver o login, mostra a Landing Page pública (exigência do Google Verification)
    if (!showLoginForm) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white" id="public-landing-page">
          {/* Header */}
          <header className="w-full max-w-7xl mx-auto px-6 py-6 flex justify-between items-center border-b border-slate-900 z-10">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-lg tracking-tight text-white block font-sans">Legal Prime</span>
                <span className="text-[10px] text-slate-400 font-medium">SaaS de Gestão Litigiosa Integrada</span>
              </div>
            </div>
            <button
              onClick={() => setShowLoginForm(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-xl text-xs cursor-pointer shadow-md shadow-indigo-600/10 transition-all"
            >
              Entrar no Sistema
            </button>
          </header>

          {/* Main Content */}
          <main className="flex-1 flex flex-col justify-center items-center px-6 py-16 max-w-4xl mx-auto relative z-10 text-center space-y-8">
            {/* Background Accents */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/5 rounded-full blur-3xl animate-pulse" />

            <div className="space-y-4">
              <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
                Solução Completa para Escritórios de Advocacia
              </span>
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white font-sans max-w-3xl leading-tight">
                Gestão de Processos, Prazos e Sincronização Inteligente
              </h1>
              <p className="text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed">
                O <strong>Legal Prime</strong> centraliza o controle do seu escritório jurídico. Automatize o acompanhamento processual de ponta a ponta, organize seus clientes no CRM integrado e garanta que nenhum prazo seja perdido com nossa sincronização avançada.
              </p>
            </div>

            {/* Google Calendar Box */}
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl max-w-xl text-left space-y-4 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 rounded-xl flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <h2 className="font-semibold text-white text-base font-sans">Integração Oficial com Google Agenda</h2>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Nossa plataforma integra-se de forma nativa e bidirecional com a <strong>Google Calendar API</strong> para permitir que seus prazos, compromissos judiciais, reuniões com clientes e audiências geradas no Legal Prime apareçam imediatamente na sua agenda pessoal e profissional do Google.
              </p>
              <div className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-800/80 pt-3">
                <strong>Uso de Dados do Usuário do Google:</strong> Solicitamos acesso ao escopo de visualizar e editar calendários para sincronizar exclusivamente os eventos jurídicos cadastrados na nossa plataforma com a sua conta Google. Respeitamos a sua privacidade e não compartilhamos esses dados com terceiros, sob nenhuma circunstância.
              </div>
            </div>

            <div>
              <button
                onClick={() => setShowLoginForm(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-3.5 rounded-2xl text-xs cursor-pointer shadow-lg shadow-indigo-600/10 transition-all inline-flex items-center gap-2"
              >
                Acessar Minha Conta Corporativa <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          </main>

          {/* Footer */}
          <footer className="w-full border-t border-slate-900 py-6 px-6 z-10 mt-auto">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-[11px] text-slate-500">
              <p>© 2026 Legal Prime. Todos os direitos reservados.</p>
              <div className="flex flex-wrap gap-4 md:gap-6 justify-center">
                <a href="/politica-privacidade" className="hover:text-indigo-400 transition-colors">Política de Privacidade</a>
                <a href="/termos-servico" className="hover:text-indigo-400 transition-colors">Termos de Serviço</a>
                <span>Suporte: r.e.cardoso77@gmail.com</span>
              </div>
            </div>
          </footer>
        </div>
      );
    }

    // Tela de Login Tradicional sem Conta Google, com opção "Esqueci a Senha"
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-indigo-500 selection:text-white" id="auth-login-screen">
        {/* Abstract Background Accents */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl animate-pulse" />

        <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-md border border-slate-800 p-8 rounded-3xl shadow-2xl relative z-10 space-y-6">
          <div className="text-center space-y-2">
            <div className="h-12 w-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto shadow-lg shadow-indigo-600/20">
              <Scale className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white font-sans mt-3">Legal Prime</h1>
            <p className="text-xs text-slate-400">Entre na plataforma administrativa de controle de processos e prazos.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Endereço de E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ex: seu-email@dominio.com"
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-4 py-3 text-xs outline-none focus:border-indigo-500 placeholder-slate-600"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Senha Corporativa</label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotPasswordEmail(email); // pré-preenche com o e-mail digitado
                    setForgotPasswordSuccess(null);
                    setForgotPasswordError(null);
                    setForgotPasswordSimulatedLink(null);
                    setIsForgotPasswordOpen(true);
                  }}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                >
                  Esqueci a senha?
                </button>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-4 py-3 text-xs outline-none focus:border-indigo-500 placeholder-slate-600"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all text-xs cursor-pointer shadow-md shadow-indigo-600/10"
            >
              {loginLoading ? "Acessando..." : "Entrar no Painel"}
            </button>
          </form>

          <button
            onClick={() => setShowLoginForm(false)}
            className="w-full text-center py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-400 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Voltar para a Página Inicial
          </button>

          {/* Atalhos Rápidos para Demonstração removidos */}
        </div>

        {/* Modal Esqueci a Senha */}
        {isForgotPasswordOpen && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl max-w-md w-full p-6 shadow-2xl flex flex-col space-y-4 animate-fadeIn">
              <div className="text-center space-y-2">
                <div className="h-10 w-10 bg-indigo-600/10 text-indigo-400 rounded-xl flex items-center justify-center mx-auto">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-base text-white font-sans mt-2">Recuperar Senha Corporativa</h3>
                <p className="text-xs text-slate-400">
                  Insira o seu e-mail cadastrado. Se o servidor de envio (SMTP) estiver configurado, você receberá um link de redefinição de senha real.
                </p>
              </div>

              {forgotPasswordError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>{forgotPasswordError}</span>
                </div>
              )}

              {forgotPasswordSuccess && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                    <span className="font-semibold">Instruções Processadas!</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    {forgotPasswordSuccess}
                  </p>
                  
                  {forgotPasswordSimulatedLink && (
                    <div className="pt-2 border-t border-emerald-500/20 space-y-2">
                      <p className="text-[10px] text-amber-300 font-semibold">
                        💡 Ambiente de Preview: O SMTP configurado no painel do escritório é fictício/simulado. Você pode testar o fluxo clicando no atalho abaixo:
                      </p>
                      <a
                        href={forgotPasswordSimulatedLink}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all text-xs"
                      >
                        <ArrowUpRight className="w-4 h-4" /> Redirecionar para Redefinir Senha
                      </a>
                    </div>
                  )}
                </div>
              )}

              {!forgotPasswordSuccess && (
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Endereço de E-mail Corporativo</label>
                    <input
                      type="email"
                      required
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      placeholder="Ex: rodrigo.cardoso@sportix.com.br"
                      className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-4 py-3 text-xs outline-none focus:border-indigo-500 placeholder-slate-700"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={forgotPasswordLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all text-xs cursor-pointer shadow-md shadow-indigo-600/10"
                  >
                    {forgotPasswordLoading ? "Enviando..." : "Enviar Link de Recuperação"}
                  </button>
                </form>
              )}

              <button
                type="button"
                onClick={() => setIsForgotPasswordOpen(false)}
                className="w-full text-center py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-400 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Fechar Janela
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // PORTAL DO CLIENTE - Exclusivo para clientes do escritório
  if (user.role === "client") {
    // Filter objects belonging to the client
    const clientProcesses = processes; // already filtered by server API for safety
    const clientInvoices = finances; // already filtered by server
    const clientDocs = documents; // already filtered by server

    return (
      <div 
        className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 selection:bg-primary-theme selection:text-white" 
        id="client-portal-workspace"
        style={{
          '--theme-primary': activeFirm?.primary_color || '#4f46e5',
          '--theme-secondary': activeFirm?.secondary_color || '#111827',
        } as React.CSSProperties}
      >
        {/* Navigation bar for client */}
        <header className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center border-b border-slate-850 shadow-md">
          <div className="flex items-center gap-2">
            {activeFirm?.logo_url ? (
              <img 
                src={activeFirm.logo_url} 
                alt={activeFirmName} 
                className="h-9 w-9 object-contain rounded-xl bg-white p-1 border border-slate-700/50"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="h-9 w-9 bg-primary-theme rounded-xl flex items-center justify-center text-white font-bold">
                <Scale className="w-4 h-4" />
              </div>
            )}
            <div>
              <h1 className="font-bold text-sm tracking-tight">Portal do Cliente</h1>
              <p className="text-[10px] text-slate-400 font-medium">{activeFirmName}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-xl border border-slate-700/60 font-semibold">
              Olá, {user.name} (Cliente)
            </span>
            <button
              onClick={handleLogout}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
              title="Sair do Portal"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Portal Dashboard Grid */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Content Area */}
          <section className="lg:col-span-8 space-y-6">
            {/* Quick Greeting */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl">
              <h2 className="font-semibold text-slate-900 text-base">Meus Processos em Andamento</h2>
              <p className="text-xs text-slate-400 mt-0.5">Andamento em tempo real capturado diretamente dos tribunais.</p>

              <div className="grid grid-cols-1 gap-3 mt-4">
                {clientProcesses.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-4">Nenhum processo judicial cadastrado em seu nome no momento.</p>
                ) : (
                  clientProcesses.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => handleFetchClientProcessDetails(p.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        clientProcessSelected?.id === p.id ? "bg-indigo-50/50 border-indigo-200" : "bg-slate-50 border-slate-200/80 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-slate-800 text-xs sm:text-sm">{p.title}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">CNJ: {p.cnj} • {p.court}</p>
                        </div>
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-semibold px-2 py-0.5 rounded-full">
                          {p.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Selected Process Timeline detail view */}
            {clientProcessSelected && (
              <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4 animate-fade-in">
                <h3 className="font-semibold text-slate-900 text-sm border-b border-slate-100 pb-2">
                  Histórico de Movimentações: {clientProcessSelected.title}
                </h3>
                <div className="border-l border-slate-200 ml-2 pl-4 space-y-3">
                  {clientProcessSelected.movements?.map((m: any) => (
                    <div key={m.id} className="relative text-xs">
                      <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-indigo-600" />
                      <span className="text-[9px] text-slate-400 font-mono block">
                        {new Date(m.date).toLocaleDateString("pt-BR")}
                      </span>
                      <p className="text-slate-700 font-medium">{m.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Right sidebar Client Portal: Invoices & signatures */}
          <aside className="lg:col-span-4 space-y-6">
            {/* Pix bills */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4">
              <h3 className="font-semibold text-slate-900 text-sm">Faturas e Honorários</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Pague faturas do escritório com compensação automática via Pix.</p>

              <div className="space-y-3">
                {clientInvoices.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Nenhuma fatura em aberto.</p>
                ) : (
                  clientInvoices.map((inv) => (
                    <div key={inv.id} className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-slate-800 text-xs truncate max-w-[150px]">{inv.description}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Vence em {new Date(inv.due_date).toLocaleDateString("pt-BR")}</p>
                        </div>
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                          inv.status === "Pago" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                        }`}>
                          {inv.status}
                        </span>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-slate-100/70">
                        <span className="font-bold text-slate-900 text-sm">R$ {inv.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        {inv.status !== "Pago" && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(inv.pix_code || "");
                              alert("Código Pix copia e cola copiado com sucesso! Pague no aplicativo do seu banco.");
                            }}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-2.5 py-1.5 rounded-lg text-[10px] cursor-pointer"
                          >
                            Copiar PIX
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Document signing requests */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4">
              <h3 className="font-semibold text-slate-900 text-sm">Documentos e Assinaturas</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Revise e assine procurações eletrônicas sem sair de casa.</p>

              <div className="space-y-2">
                {clientDocs.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Nenhum documento pendente de sua assinatura.</p>
                ) : (
                  clientDocs.map((doc) => {
                    const isSigned = doc.signatures?.length > 0;

                    return (
                      <div key={doc.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-slate-800 text-xs">{doc.name}</p>
                          <p className="text-[9px] text-slate-400">{doc.category}</p>
                        </div>

                        {isSigned ? (
                          <span className="text-[9px] bg-emerald-50 text-emerald-600 font-semibold px-2 py-1 rounded-lg border border-emerald-100 flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3" /> Assinado
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSignClientDoc(doc.id)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[9px] px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-1"
                          >
                            <FileSignature className="w-3 h-3" /> Assinar PDF
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </aside>
        </main>
      </div>
    );
  }

  // OPERADORES / ADVOGADOS WORKSPACE (DASHBOARD COMPLETO)
  const hasFinancialAccess = user.role === "admin" || user.role === "partner" || user.role === "finance" || user.permissions?.includes("FINANCIAL_ACCESS");

  return (
    <div 
      className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 selection:bg-primary-theme selection:text-white" 
      id="main-admin-workspace"
      style={{
        '--theme-primary': activeFirm?.primary_color || '#4f46e5',
        '--theme-secondary': activeFirm?.secondary_color || '#111827',
      } as React.CSSProperties}
    >
      {/* Top Banner Navigation bar */}
      <header 
        className={`px-6 py-4 flex justify-between items-center shadow-md relative z-30 transition-colors border-b ${headerBorderColor} ${headerTextColor}`}
        style={{ backgroundColor: 'var(--theme-primary)' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`p-1.5 rounded-lg sm:hidden transition-colors ${headerHoverBg} ${headerTextColor}`}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          
          {activeFirm?.logo_url ? (
            <img 
              src={activeFirm.logo_url} 
              alt={activeFirmName} 
              className={`h-10 w-10 object-contain rounded-xl bg-white p-1 border ${headerBorderColor}`} 
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="h-10 w-10 bg-[var(--theme-secondary)] rounded-xl flex items-center justify-center text-white font-bold">
              <Scale className="w-5 h-5" />
            </div>
          )}
          <div>
            <h1 className="font-bold text-sm tracking-tight flex items-center gap-1.5">
              {activeFirmName} <span className={`text-[9px] px-2 py-0.5 rounded-md ${isSecondaryLight ? 'bg-slate-200 text-slate-800' : 'bg-black/20 text-slate-100'}`}>V2.4</span>
            </h1>
            <p className={`text-[10px] font-medium ${headerMutedTextColor}`}>SaaS de Gestão Litigiosa Integrada</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user && (user.role === "admin" || user.email === "rodrigo.cardoso@sportix.com.br") && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs ${headerBorderColor}`} style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
              <span className={`font-medium ${headerMutedTextColor}`}>Cluster:</span>
              <select
                value={selectedLawFirmFilter}
                onChange={(e) => setSelectedLawFirmFilter(e.target.value)}
                className={`bg-transparent border-none focus:outline-none cursor-pointer font-semibold outline-none pr-1 ${headerTextColor}`}
              >
                <option value="all" className="bg-slate-900 text-slate-200 font-normal">Todos os Escritórios</option>
                {lawFirms.map((f) => (
                  <option key={f.id} value={f.id} className="bg-slate-900 text-slate-200 font-normal">
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* AI trigger button */}
          <button
            onClick={() => setIsAiOpen(true)}
            className={`font-semibold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer animate-pulse transition-colors border ${
              isPrimaryLight 
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300' 
                : 'bg-white/10 hover:bg-white/20 text-slate-200 border-white/20'
            }`}
          >
            <Bot className="w-4 h-4 text-[var(--theme-secondary)]" /> Assistente IA
          </button>

          {/* User profile details and logout */}
          {user && (
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className={`hidden sm:flex items-center gap-2 border px-3 py-1 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                isPrimaryLight 
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800' 
                  : 'bg-white/10 hover:bg-white/20 border-white/10 text-slate-200'
              }`}
              title="Clique para alterar seu nome e senha"
            >
              <UserCheck className="w-4 h-4 text-[var(--theme-secondary)]" />
              <span>{user.name} ({user.role.toUpperCase()})</span>
            </button>
          )}

          <button
            onClick={handleLogout}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              isPrimaryLight 
                ? 'text-slate-600 hover:bg-slate-200 hover:text-slate-900' 
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
            title="Encerrar sessão"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Container Workspace */}
      <div className="flex-1 flex relative">
        {/* Left Side Navigation bar */}
        <nav 
          className={`w-64 border-r text-xs font-medium py-6 px-4 space-y-1.5 flex-shrink-0 absolute sm:relative z-20 top-0 bottom-0 transition-transform sm:translate-x-0 transition-all ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          } ${isPrimaryLight ? 'border-slate-200' : 'border-white/10'}`}
          style={{ backgroundColor: 'var(--theme-primary)' }}
        >
          <div className={`text-[10px] font-semibold uppercase tracking-wider px-3 mb-3 ${isPrimaryLight ? 'text-slate-600' : 'text-white/50'}`}>Escritório</div>
          
          <button
            onClick={() => { setActiveTab("dashboard"); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
              activeTab === "dashboard" ? `${sidebarActiveBg} ${sidebarActiveTextColor} shadow-sm` : `${sidebarTextColor} ${sidebarHoverBg}`
            }`}
          >
            <LayoutDashboard className="w-4 h-4" /> Painel de Controle
          </button>

          <button
            onClick={() => { setActiveTab("clients"); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
              activeTab === "clients" ? `${sidebarActiveBg} ${sidebarActiveTextColor} shadow-sm` : `${sidebarTextColor} ${sidebarHoverBg}`
            }`}
          >
            <Users className="w-4 h-4" /> Clientes (CRM)
          </button>

          <button
            onClick={() => { setActiveTab("processes"); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
              activeTab === "processes" ? `${sidebarActiveBg} ${sidebarActiveTextColor} shadow-sm` : `${sidebarTextColor} ${sidebarHoverBg}`
            }`}
          >
            <Scale className="w-4 h-4" /> Processos Judiciais
          </button>

          <button
            onClick={() => { setActiveTab("publications"); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
              activeTab === "publications" ? `${sidebarActiveBg} ${sidebarActiveTextColor} shadow-sm` : `${sidebarTextColor} ${sidebarHoverBg}`
            }`}
          >
            <Newspaper className="w-4 h-4" /> Publicações & Diários
          </button>

          <button
            onClick={() => { setActiveTab("agenda"); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
              activeTab === "agenda" ? `${sidebarActiveBg} ${sidebarActiveTextColor} shadow-sm` : `${sidebarTextColor} ${sidebarHoverBg}`
            }`}
          >
            <Calendar className="w-4 h-4" /> Agenda e Prazos
          </button>

          <button
            onClick={() => { setActiveTab("documents"); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
              activeTab === "documents" ? `${sidebarActiveBg} ${sidebarActiveTextColor} shadow-sm` : `${sidebarTextColor} ${sidebarHoverBg}`
            }`}
          >
            <FileText className="w-4 h-4" /> Documentos e Assinatura
          </button>

          <button
            onClick={() => { setActiveTab("calculos"); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
              activeTab === "calculos" ? `${sidebarActiveBg} ${sidebarActiveTextColor} shadow-sm` : `${sidebarTextColor} ${sidebarHoverBg}`
            }`}
          >
            <Calculator className="w-4 h-4" /> Cálculos Judiciais
          </button>

          {hasFinancialAccess && (
            <>
              <div className={`text-[10px] font-semibold uppercase tracking-wider px-3 pt-6 mb-3 ${isPrimaryLight ? 'text-slate-600' : 'text-white/50'}`}>Financeiro & Automação</div>

              <button
                onClick={() => { setActiveTab("financial"); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                  activeTab === "financial" ? `${sidebarActiveBg} ${sidebarActiveTextColor} shadow-sm` : `${sidebarTextColor} ${sidebarHoverBg}`
                }`}
              >
                <TrendingUp className="w-4 h-4" /> Fluxo de Caixa e Pix
              </button>

              <button
                onClick={() => { setActiveTab("reports_bi"); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                  activeTab === "reports_bi" ? `${sidebarActiveBg} ${sidebarActiveTextColor} shadow-sm` : `${sidebarTextColor} ${sidebarHoverBg}`
                }`}
              >
                <BarChart3 className="w-4 h-4" /> Relatórios & BI
              </button>
            </>
          )}

          <button
            onClick={() => { setActiveTab("workflows"); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
              activeTab === "workflows" ? `${sidebarActiveBg} ${sidebarActiveTextColor} shadow-sm` : `${sidebarTextColor} ${sidebarHoverBg}`
            }`}
          >
            <Zap className="w-4 h-4" /> Automação Workflows
          </button>

          {(user.role === "admin" || user.role === "partner" || user.permissions?.includes("BYPASS_LGPD")) && (
            <>
              <div className={`text-[10px] font-semibold uppercase tracking-wider px-3 pt-6 mb-3 ${isPrimaryLight ? 'text-slate-600' : 'text-white/50'}`}>Administração</div>
              <button
                onClick={() => { setActiveTab("admin"); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                  activeTab === "admin" ? `${sidebarActiveBg} ${sidebarActiveTextColor} shadow-sm` : `${sidebarTextColor} ${sidebarHoverBg}`
                }`}
              >
                <ShieldAlert className="w-4 h-4" /> Controle Adm / LGPD
              </button>
            </>
          )}
        </nav>

        {/* Dynamic Content Frame */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-50 relative z-10">
          {activeTab === "dashboard" && (
            <Dashboard
              processes={processes}
              events={events}
              finances={finances}
              documents={documents}
              onNavigate={setActiveTab}
              userRole={user.role}
              activeFirm={activeFirm}
            />
          )}

          {activeTab === "clients" && (
            <Clients
              clients={clients}
              processes={processes}
              token={token}
              onRefresh={() => handleFetchAllData(token)}
              userRole={user.role}
            />
          )}

          {activeTab === "processes" && (
            <Processes
              processes={processes}
              clients={clients}
              token={token}
              onRefresh={() => handleFetchAllData(token)}
              userRole={user.role}
            />
          )}

          {activeTab === "publications" && user && (
            <Publications
              currentUser={user}
              processes={processes}
              token={token}
              onRefresh={() => handleFetchAllData(token)}
              userRole={user.role}
            />
          )}

          {activeTab === "agenda" && (
            <Agenda
              events={events}
              processes={processes}
              token={token}
              onRefresh={() => handleFetchAllData(token)}
              userRole={user.role}
              currentUser={user}
              isGoogleConnected={isGoogleConnected}
              onConnectGoogle={(email) => {
                localStorage.setItem("google_connected", "true");
                if (email) {
                  localStorage.setItem("google_connected_email", email);
                }
                setIsGoogleConnected(true);
              }}
              onDisconnectGoogle={() => {
                localStorage.removeItem("google_connected");
                localStorage.removeItem("google_connected_email");
                setIsGoogleConnected(false);
              }}
              activeFirm={activeFirm}
            />
          )}

          {activeTab === "documents" && (
            <Documents
              documents={documents}
              clients={clients}
              processes={processes}
              token={token}
              onRefresh={() => handleFetchAllData(token)}
              userRole={user.role}
              activeFirm={activeFirm}
            />
          )}

          {activeTab === "financial" && hasFinancialAccess && (
            <Financial
              finances={finances}
              clients={clients}
              processes={processes}
              token={token}
              onRefresh={() => handleFetchAllData(token)}
              userRole={user.role}
            />
          )}

          {activeTab === "workflows" && (
            <Workflows
              workflows={workflows}
              token={token}
              onRefresh={() => handleFetchAllData(token)}
              userRole={user.role}
            />
          )}

          {activeTab === "calculos" && (
            <Calculos
              activeFirm={activeFirm}
              userRole={user.role}
            />
          )}

          {activeTab === "reports_bi" && hasFinancialAccess && (
            <ReportsBI
              processes={processes}
              clients={clients}
              finances={finances}
              documents={documents}
              events={events}
              activeFirm={activeFirm}
              userRole={user.role}
            />
          )}

          {activeTab === "admin" && (
            <AdminPanel
              users={users}
              token={token}
              onRefresh={() => handleFetchAllData(token)}
              userRole={user.role}
              currentUser={user}
            />
          )}
        </main>
      </div>

      {/* AI Assistant Persistent Slide Drawer Panel */}
      <AiAssistant
        isOpen={isAiOpen}
        onClose={() => setIsAiOpen(false)}
        token={token}
      />

      {/* Modal para alteração do perfil do próprio usuário */}
      <AnimatePresence>
        {isProfileModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-indigo-100 max-w-md w-full shadow-xl overflow-hidden text-slate-800"
            >
              <div className="bg-indigo-900 px-6 py-4 text-white flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-sm">Editar Seu Perfil</h3>
                  <p className="text-[10px] text-indigo-200 mt-0.5">Altere seu nome e dados de acesso</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors cursor-pointer text-indigo-200 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="p-6 space-y-4 text-xs">
                {profileError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl font-medium">
                    {profileError}
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    E-mail de Acesso
                  </label>
                  <input
                    type="email"
                    required
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    placeholder="exemplo@dominio.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Nova Senha (Opcional)
                  </label>
                  <input
                    type="password"
                    value={profilePassword}
                    onChange={(e) => setProfilePassword(e.target.value)}
                    placeholder="Deixe em branco para manter a atual"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500 font-medium"
                  />
                  <p className="text-[9px] text-slate-400 mt-0.5">Preencha apenas se quiser alterar sua senha.</p>
                </div>

                <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsProfileModalOpen(false)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold px-4 py-2 rounded-xl cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2 rounded-xl shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {isSavingProfile ? "Salvando..." : "Salvar Alterações"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
