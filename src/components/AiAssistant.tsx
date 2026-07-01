import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Bot, User, X, MessageSquare, CornerDownLeft, RotateCcw, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Message {
  role: "user" | "model";
  text: string;
}

interface AiAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  contextText?: string;
}

export default function AiAssistant({ isOpen, onClose, token, contextText }: AiAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "model",
      text: "Olá! Sou o **Legal Prime AI**, seu copiloto jurídico inteligente. Posso ajudar você a redigir contratos, resumir processos longos, analisar riscos contratuais ou explicar termos em linguagem simples para seus clientes. O que deseja fazer hoje?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    if (!textToSend) setInput("");

    // Append user message
    const userMsg: Message = { role: "user", text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            text: m.text,
          })),
          currentMessage: text,
          context: contextText,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessages((prev) => [...prev, { role: "model", text: data.answer }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "model", text: `⚠️ Erro do Assistente: ${data.error || "Tente novamente."}` },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "model", text: "⚠️ Falha de comunicação com a Inteligência Artificial. Certifique-se de que a API Key está configurada." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        role: "model",
        text: "Histórico redefinido. Como posso ajudar nas suas atividades de advocacia agora?",
      },
    ]);
  };

  const applyShortcut = (shortcutText: string) => {
    handleSendMessage(shortcutText);
  };

  const shortcuts = [
    { label: "Explicar Termo", prompt: "Como posso explicar o termo 'Trânsito em Julgado com efeito devolutivo' de forma simples para um cliente leigo?" },
    { label: "Minutar E-mail", prompt: "Crie um modelo de e-mail formal e amigável notificando o cliente de que o juiz agendou a audiência de conciliação para daqui a 30 dias." },
    { label: "Análise Cláusula", prompt: "Redija uma cláusula rígida de confidencialidade e proteção de dados em conformidade direta com a LGPD para um contrato de prestação de serviços." },
    { label: "Parecer Rápido", prompt: "Quais são os principais riscos jurídicos para uma empresa de e-commerce que atrasa a entrega de produtos no Código de Defesa do Consumidor?" }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop mask */}
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-xs z-40 transition-opacity"
            onClick={onClose}
          />

          {/* AI Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 20, stiffness: 100 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[480px] bg-slate-900 border-l border-slate-800 text-slate-100 shadow-2xl z-50 flex flex-col h-full"
            id="ai-assistant-drawer"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm tracking-tight text-white flex items-center gap-1.5">
                    Legal Prime AI <span className="text-[10px] bg-indigo-500/30 text-indigo-300 px-1.5 py-0.5 rounded-full font-medium">Copilot</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" /> Ativo em conformidade LGPD
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={clearChat}
                  title="Limpar histórico"
                  className="p-1.5 hover:bg-slate-800 rounded-md text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-slate-800 rounded-md text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex gap-3 max-w-[85%] ${
                    msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                  }`}
                >
                  <div
                    className={`p-1.5 rounded-lg flex-shrink-0 h-8 w-8 flex items-center justify-center ${
                      msg.role === "user"
                        ? "bg-slate-800 text-slate-300"
                        : "bg-indigo-600/35 text-indigo-400"
                    }`}
                  >
                    {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div
                    className={`p-3 rounded-2xl text-xs leading-relaxed ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white rounded-tr-none"
                        : "bg-slate-800/90 text-slate-200 border border-slate-700/50 rounded-tl-none"
                    }`}
                  >
                    {/* Simplified markdown rendering */}
                    {msg.text.split("\n").map((line, lIdx) => {
                      let parsedLine = line;
                      // Strong bold bold markdown regex match
                      const boldRegex = /\*\*(.*?)\*\*/g;
                      let match;
                      const parts = [];
                      let lastIndex = 0;
                      while ((match = boldRegex.exec(line)) !== null) {
                        parts.push(line.substring(lastIndex, match.index));
                        parts.push(<strong key={match.index} className="text-white font-semibold">{match[1]}</strong>);
                        lastIndex = boldRegex.lastIndex;
                      }
                      parts.push(line.substring(lastIndex));

                      return (
                        <p key={lIdx} className={line === "" ? "h-2" : "mb-1.5"}>
                          {parts.length > 1 ? parts : parsedLine}
                        </p>
                      );
                    })}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex gap-3 max-w-[80%] mr-auto items-center text-xs text-slate-400">
                  <div className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center animate-spin">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span>Analisando fatos jurídicos...</span>
                </div>
              )}
            </div>

            {/* Quick Shortcuts */}
            <div className="px-4 py-2 border-t border-slate-800 bg-slate-950/60">
              <p className="text-[10px] text-slate-400 mb-2 font-medium flex items-center gap-1">
                <MessageSquare className="w-3 h-3 text-indigo-400" /> Prompts Rápidos de Advocacia:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {shortcuts.map((sc, i) => (
                  <button
                    key={i}
                    onClick={() => applyShortcut(sc.prompt)}
                    className="text-[10px] bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 px-2 py-1 rounded-md border border-slate-700/60 transition-colors cursor-pointer"
                  >
                    {sc.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer Input Area */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendMessage();
                }}
                placeholder="Pergunte sobre um processo, peça ou dúvida..."
                className="flex-1 bg-slate-800 text-xs text-white border border-slate-700 rounded-lg px-3 py-2.5 outline-none focus:border-indigo-500 placeholder-slate-500"
              />
              <button
                onClick={() => handleSendMessage()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg p-2.5 transition-colors flex items-center justify-center cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
