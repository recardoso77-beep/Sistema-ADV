import React, { useState, useEffect } from "react";
import { Scale, Users, Calendar, FileText, TrendingUp, Zap, ShieldAlert, Sparkles, LogOut, LayoutDashboard, UserCheck, Bot, Menu, X, ArrowUpRight, Copy, CheckCircle2, FileSignature, Database, Newspaper, Cloud, KeyRound } from "lucide-react";
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

  // Navigation State
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Login Form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState(localStorage.getItem("google_connected") === "true");
  const [isGoogleSelectModalOpen, setIsGoogleSelectModalOpen] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState("");

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
    } else {
      document.documentElement.style.setProperty("--theme-primary", "#4f46e5");
      document.documentElement.style.setProperty("--theme-secondary", "#111827");
    }
  }, [activeFirm]);

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
      <header className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shadow-md relative z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 hover:bg-slate-800 rounded-lg sm:hidden text-slate-300"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          
          {activeFirm?.logo_url ? (
            <img 
              src={activeFirm.logo_url} 
              alt={activeFirmName} 
              className="h-10 w-10 object-contain rounded-xl bg-white p-1 border border-slate-700/50" 
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="h-10 w-10 bg-primary-theme rounded-xl flex items-center justify-center text-white font-bold">
              <Scale className="w-5 h-5" />
            </div>
          )}
          <div>
            <h1 className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
              {activeFirmName} <span className="text-[9px] bg-primary-theme/20 text-indigo-300 px-2 py-0.5 rounded-md">V2.4</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-medium">SaaS de Gestão Litigiosa Integrada</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user && (user.role === "admin" || user.email === "rodrigo.cardoso@sportix.com.br") && (
            <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700/60 text-xs text-slate-300">
              <span className="text-slate-400 font-medium">Cluster:</span>
              <select
                value={selectedLawFirmFilter}
                onChange={(e) => setSelectedLawFirmFilter(e.target.value)}
                className="bg-transparent border-none text-slate-200 focus:outline-none cursor-pointer font-semibold outline-none pr-1"
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
            className="bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-semibold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer animate-pulse"
          >
            <Bot className="w-4 h-4 text-indigo-400" /> Assistente IA
          </button>

          {/* User profile details and logout */}
          {user && (
            <div className="hidden sm:flex items-center gap-2 bg-slate-800 px-3 py-1 rounded-xl border border-slate-700/60 text-xs">
              <UserCheck className="w-4 h-4 text-indigo-400" />
              <span className="font-semibold text-slate-200">{user.name} ({user.role.toUpperCase()})</span>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Encerrar sessão"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Container Workspace */}
      <div className="flex-1 flex relative">
        {/* Left Side Navigation bar */}
        <nav className={`w-64 bg-slate-900 border-r border-slate-850 text-slate-400 text-xs font-medium py-6 px-4 space-y-1.5 flex-shrink-0 absolute sm:relative z-20 top-0 bottom-0 transition-transform sm:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}>
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 mb-3">Escritório</div>
          
          <button
            onClick={() => { setActiveTab("dashboard"); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
              activeTab === "dashboard" ? "bg-primary-theme text-white font-semibold" : "hover:bg-slate-800/60 hover:text-slate-200"
            }`}
          >
            <LayoutDashboard className="w-4 h-4" /> Painel de Controle
          </button>

          <button
            onClick={() => { setActiveTab("clients"); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
              activeTab === "clients" ? "bg-primary-theme text-white font-semibold" : "hover:bg-slate-800/60 hover:text-slate-200"
            }`}
          >
            <Users className="w-4 h-4" /> Clientes (CRM)
          </button>

          <button
            onClick={() => { setActiveTab("processes"); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
              activeTab === "processes" ? "bg-primary-theme text-white font-semibold" : "hover:bg-slate-800/60 hover:text-slate-200"
            }`}
          >
            <Scale className="w-4 h-4" /> Processos Judiciais
          </button>

          <button
            onClick={() => { setActiveTab("publications"); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
              activeTab === "publications" ? "bg-primary-theme text-white font-semibold" : "hover:bg-slate-800/60 hover:text-slate-200"
            }`}
          >
            <Newspaper className="w-4 h-4" /> Publicações & Diários
          </button>

          <button
            onClick={() => { setActiveTab("agenda"); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
              activeTab === "agenda" ? "bg-primary-theme text-white font-semibold" : "hover:bg-slate-800/60 hover:text-slate-200"
            }`}
          >
            <Calendar className="w-4 h-4" /> Agenda e Prazos
          </button>

          <button
            onClick={() => { setActiveTab("documents"); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
              activeTab === "documents" ? "bg-primary-theme text-white font-semibold" : "hover:bg-slate-800/60 hover:text-slate-200"
            }`}
          >
            <FileText className="w-4 h-4" /> Documentos e Assinatura
          </button>

          {hasFinancialAccess && (
            <>
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 pt-6 mb-3">Financeiro & Automação</div>

              <button
                onClick={() => { setActiveTab("financial"); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                  activeTab === "financial" ? "bg-primary-theme text-white font-semibold" : "hover:bg-slate-800/60 hover:text-slate-200"
                }`}
              >
                <TrendingUp className="w-4 h-4" /> Fluxo de Caixa e Pix
              </button>
            </>
          )}

          <button
            onClick={() => { setActiveTab("workflows"); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
              activeTab === "workflows" ? "bg-primary-theme text-white font-semibold" : "hover:bg-slate-800/60 hover:text-slate-200"
            }`}
          >
            <Zap className="w-4 h-4" /> Automação Workflows
          </button>

          {(user.role === "admin" || user.role === "partner" || user.permissions?.includes("BYPASS_LGPD")) && (
            <>
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 pt-6 mb-3">Administração</div>
              <button
                onClick={() => { setActiveTab("admin"); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                  activeTab === "admin" ? "bg-primary-theme text-white font-semibold" : "hover:bg-slate-800/60 hover:text-slate-200"
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
    </div>
  );
}
