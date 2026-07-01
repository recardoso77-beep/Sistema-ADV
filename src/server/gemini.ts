import { GoogleGenAI } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not configured. Please add it in Settings > Secrets.");
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

export const LegalAI = {
  /**
   * Summarizes legal process contents and movements into readable briefs.
   */
  async summarizeProcess(title: string, area: string, description: string, movements: any[]): Promise<string> {
    try {
      const client = getGeminiClient();
      const movementsText = movements
        .map((m) => `[${new Date(m.date).toLocaleDateString("pt-BR")}] - ${m.description}`)
        .join("\n");

      const prompt = `Como um Arquiteto de Inteligência Jurídica Sênior, analise e crie um resumo executivo, objetivo e claro deste processo judicial para advogados e sócios:
      
Título do Processo: ${title}
Área do Direito: ${area}
Descrição do Caso: ${description}
Movimentações Recentes:
${movementsText || "Sem movimentações cadastradas."}

Por favor, estruture seu resumo com:
1. **Status Geral**: Resumo de 1 frase do andamento atual.
2. **Pontos Críticos**: Quais são os prazos ou riscos imediatos detectados.
3. **Plano de Ação Sugerido**: Próximos passos práticos sugeridos para o advogado.
Use formatação Markdown limpa em português brasileiro.`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          temperature: 0.3,
        }
      });

      return response.text || "Não foi possível gerar o resumo.";
    } catch (error: any) {
      console.error("Gemini AI summarizeProcess error:", error);
      return `Erro na Inteligência Artificial: ${error.message || "Verifique se a GEMINI_API_KEY está configurada corretamente."}`;
    }
  },

  /**
   * Translates highly technical legal jargon into plain language for clients.
   */
  async explainToClient(title: string, description: string, technicalText: string): Promise<string> {
    try {
      const client = getGeminiClient();
      const prompt = `Você é um Advogado Conciliador altamente empático especializado em comunicação clara. Seu cliente é uma pessoa leiga que não entende termos jurídicos complicados ("juridiquês").
      
Explique para ele de forma acolhedora, transparente e simples o significado de:
"${technicalText}"

Contexto do Processo:
Processo: ${title} (${description})

Orientações:
- Evite termos em latim ou jargões pesados. Se precisar usá-los, explique imediatamente com metáforas simples.
- Diga o que isso significa na prática para o caso dele.
- Mantenha um tom profissional, amigável e tranquilizador.
Use Markdown para destacar pontos importantes.`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          temperature: 0.4,
        }
      });

      return response.text || "Não foi possível gerar a explicação.";
    } catch (error: any) {
      console.error("Gemini AI explainToClient error:", error);
      return `Erro na Inteligência Artificial: ${error.message || "Verifique se a GEMINI_API_KEY está configurada."}`;
    }
  },

  /**
   * Generates structural contract drafts based on specific terms.
   */
  async generateContract(title: string, partyA: string, partyB: string, terms: string): Promise<string> {
    try {
      const client = getGeminiClient();
      const prompt = `Gere uma minuta preliminar de alta qualidade para um contrato jurídico com os seguintes parâmetros:
      
Tipo/Título do Contrato: ${title}
Contratante/Parte A: ${partyA}
Contratado/Parte B: ${partyB}
Termos, Cláusulas Específicas e Condições de Negócio:
${terms}

Por favor, forneça o contrato estruturado em capítulos/cláusulas formais aplicáveis no Brasil (padrão LGPD, foro, obrigações, multas, vigência e rescisão). Adicione placeholders para preenchimento de dados adicionais onde aplicável. Use formatação Markdown profissional com títulos claros.`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          temperature: 0.5,
        }
      });

      return response.text || "Não foi possível gerar o contrato.";
    } catch (error: any) {
      console.error("Gemini AI generateContract error:", error);
      return `Erro ao gerar o contrato com IA: ${error.message || "Verifique sua chave de API."}`;
    }
  },

  /**
   * Generates a legal petition/initial claim template.
   */
  async generatePetition(area: string, facts: string, requests: string): Promise<string> {
    try {
      const client = getGeminiClient();
      const prompt = `Gere uma estrutura profissional para uma Peça Processual/Petição Inicial sob o ordenamento jurídico do Brasil (CPC):
      
Área do Direito: ${area}
Fatos Narrados:
${facts}
Pedidos / Fundamentos Desejados:
${requests}

Estruture com:
1. Endereçamento (com placeholders [Juízo Competente])
2. Qualificação das Partes (placeholders)
3. Dos Fatos
4. Dos Fundamentos Jurídicos (cite doutrina e artigos fictícios ou reais relevantes de forma genérica)
5. Dos Pedidos e Requerimentos Finais
6. Valor da causa e encerramento.
Escreva de forma polida, jurídica e extremamente técnica, ideal para subsidiar o início de peticionamento de um advogado. Use Markdown.`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          temperature: 0.3,
        }
      });

      return response.text || "Não foi possível gerar a petição.";
    } catch (error: any) {
      console.error("Gemini AI generatePetition error:", error);
      return `Erro ao gerar a petição com IA: ${error.message || "Verifique sua chave de API."}`;
    }
  },

  /**
   * Analyzes litigious risk, outcomes, and strategies.
   */
  async analyzeRisk(processTitle: string, description: string, value: number, movements: any[]): Promise<string> {
    try {
      const client = getGeminiClient();
      const movementsText = movements
        .map((m) => `[${new Date(m.date).toLocaleDateString("pt-BR")}] - ${m.description}`)
        .join("\n");

      const prompt = `Atue como um analista de risco jurídico sênior (Legal Risk Officer) e analise este caso para traçar um prognóstico de êxito e sugestões de provisionamento financeiro:
      
Caso: ${processTitle}
Valor da Causa: R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
Resumo dos fatos: ${description}
Fase processual atual / Movimentações:
${movementsText}

Responda fornecendo:
1. **Prognóstico de Êxito**: Classifique como Provável, Possível ou Remoto. Justifique em 2 parágrafos.
2. **Análise de Impacto Financeiro**: Recomende se há necessidade de provisionar o valor integral ou parcial e dê razões.
3. **Estratégia de Mitigação**: Proporcione 2 táticas alternativas de resolução (ex: acordo judicial, embargos estruturais) que minimizem a exposição do cliente.
Use Markdown elegante em português brasileiro.`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          temperature: 0.2,
        }
      });

      return response.text || "Não foi possível analisar o risco.";
    } catch (error: any) {
      console.error("Gemini AI analyzeRisk error:", error);
      return `Erro ao analisar riscos com IA: ${error.message || "Verifique sua chave de API."}`;
    }
  },

  /**
   * Universal legal helper chat.
   */
  async chatAssistant(history: { role: string; text: string }[], message: string, context?: string): Promise<string> {
    try {
      const client = getGeminiClient();
      const chat = client.chats.create({
        model: "gemini-3.5-flash",
        config: {
          systemInstruction: `Você é o "Legal Prime AI", o copiloto inteligente integrado ao sistema ERP jurídico do escritório de advocacia. 
Sua função é auxiliar os advogados a redigirem documentos, analisarem prazos, responderem dúvidas jurídicas, planejarem estratégias e agilizarem tarefas burocráticas cotidianas.
Você deve responder de forma clara, altamente profissional, objetiva e útil.
Contexto adicional do escritório de advocacia atual: ${context || "Nenhum contexto específico fornecido."}
Sempre responda em português do Brasil usando formatação Markdown amigável.`,
          temperature: 0.6,
        },
      });

      // Populate history if any
      // Since GoogleGenAI expects messages or simple sequence, we can do chat.sendMessage or build contents
      // To keep it simple and robust, let's inject the message with the history summarized or send a simple message
      let fullMessage = "";
      if (history.length > 0) {
        fullMessage += "Histórico da conversa para contexto:\n";
        history.forEach((h) => {
          fullMessage += `${h.role === "user" ? "Advogado" : "Legal Prime AI"}: ${h.text}\n`;
        });
        fullMessage += "\nNova pergunta do Advogado:\n";
      }
      fullMessage += message;

      const response = await chat.sendMessage({
        message: fullMessage,
      });

      return response.text || "Sem resposta do assistente.";
    } catch (error: any) {
      console.error("Gemini AI chatAssistant error:", error);
      return `Erro no Assistente Virtual: ${error.message || "Verifique se a chave de API está configurada."}`;
    }
  },

  /**
   * Simulates a real-time smart crawl/search in Brazilian courts (TJ, TRT, TRF, STJ)
   * by process number (CNJ), OAB number, or Lawyer/Party name.
   */
  async searchCourtsData(query: string): Promise<any[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    // LOG: Consultando
    console.log(`[PROVIDER] Consultando: "${cleanQuery}"`);

    try {
      const client = getGeminiClient();
      const prompt = `Você é um robô de busca avançado e integrador oficial dos Tribunais de Justiça Brasileiros (TJSP, TRT2, TRF3, STJ, STF).
Sua tarefa é simular um rastreamento (crawler) em tempo real e retornar dados estruturados altamente verossímeis e realistas em formato JSON para a seguinte consulta de pesquisa jurídica:
Pesquisa: "${cleanQuery}"

Determine se a pesquisa é por:
1. Número de Processo (CNJ) - Ex: "0001234-56.2023.8.26.0001"
2. OAB de Advogado - Ex: "123456/SP" ou "OAB/SP 456.789"
3. Nome de Advogado ou Parte - Ex: "José Silva", "Advocacia Cardoso"

Gere de 1 a 3 processos judiciais altamente realistas correspondentes a essa pesquisa.
Para cada processo, forneça:
- cnj: número CNJ formatado
- title: título curto da ação jurídica relevante à pesquisa (ex: Ação de Cobrança, Reclamação Trabalhista, Habeas Corpus)
- area: Cível, Trabalhista, Penal, Tributário, Família, ou Previdenciário (deve ser um desses valores)
- court: TJSP, TRT2, TRF3, STJ, ou STF (deve ser um desses valores)
- comarca: cidade/estado brasileira realista
- vara: ex: "1ª Vara Cível", "45ª Vara do Trabalho"
- description: descrição resumida detalhando a lide, as partes e o teor principal da petição inicial (2-3 parágrafos)
- value: valor da causa numérico (ex: 45000.00)
- lawyers: lista com nomes completos de advogados (se a pesquisa for OAB ou nome de advogado, garanta que o nome dele ou correspondente esteja nesta lista)
- movements: lista de 3 a 5 movimentações históricas em ordem cronológica (da mais antiga à mais recente) com:
  - date: string de data ISO (formato YYYY-MM-DDTHH:mm:ss.sssZ)
  - description: texto realista do andamento processual (ex: "Juntada de Petição", "Proferida Sentença", "Publicação de Despacho")
  - source: "Automatizado"

Retorne EXCLUSIVAMENTE um array JSON de objetos contendo exatamente esses campos. Não adicione nenhuma marcação de markdown fora do JSON.`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          temperature: 0.5,
          responseMimeType: "application/json",
        }
      });

      let responseText = response.text || "";
      if (responseText) {
        // LOG: Payload recebido
        console.log("[PROVIDER] Payload bruto recebido da API:", responseText);

        // Limpa blocos de código Markdown de JSON que o modelo pode teimar em retornar
        if (responseText.includes("```json")) {
          responseText = responseText.split("```json")[1].split("```")[0];
        } else if (responseText.includes("```")) {
          responseText = responseText.split("```")[1].split("```")[0];
        }
        
        const parsed = JSON.parse(responseText.trim());
        let results: any[] = [];
        if (Array.isArray(parsed) && parsed.length > 0) {
          results = parsed;
        } else if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
          if (Array.isArray(parsed.processos) && parsed.processos.length > 0) {
            results = parsed.processos;
          } else if (parsed.cnj) {
            results = [parsed];
          }
        }

        // LOG: Quantidade de processos
        console.log(`[PROVIDER] Quantidade de processos parseados com sucesso: ${results.length}`);
        if (results.length > 0) {
          return results;
        }
      }
    } catch (error: any) {
      // LOG: Erro e Stack completa
      console.error(`[PROVIDER] Erro: ${error.message}`);
      console.error(`[PROVIDER] Stack completa: ${error.stack}`);
      console.error("Gemini searchCourtsData failed, using fallback mock generator:", error);
    }

    // Gerador Mock de Altíssima Fidelidade e Inteligência Reativa (Garante busca funcional e resiliente)
    const normalizedQuery = cleanQuery.replace(/[\s\/-]/g, "");
    const isCNJ = /^[0-9]+$/.test(normalizedQuery) || (normalizedQuery.length > 10 && !isNaN(Number(normalizedQuery[0])));
    const isOAB = /oab/i.test(cleanQuery) || /^\d+$/.test(cleanQuery) || (cleanQuery.includes("/") && cleanQuery.length < 15);
    
    const results = [];
    
    // Processo 1: Cível
    const lawyerListCivil = ["Dr. Rodrigo Cardoso", "Dra. Patrícia Mendes"];
    let cnjCivil = "1002345-67.2024.8.26.0100";
    if (isCNJ) cnjCivil = cleanQuery;
    else if (isOAB) lawyerListCivil.unshift(`Advogado OAB ${cleanQuery.toUpperCase()}`);
    else lawyerListCivil.unshift(`Dr(a). ${cleanQuery}`);

    results.push({
      cnj: cnjCivil,
      title: "Ação de Rescisão Contratual e Indenização por Perdas e Danos",
      area: "Cível",
      court: "TJSP",
      comarca: "São Paulo/SP",
      vara: "12ª Vara Cível Central",
      description: `Controvérsia de alta complexidade versando sobre descumprimento injustificado de contrato bilateral de prestação de serviços de tecnologia corporativa. O autor alega vício grave na entrega de plataforma de e-commerce e pleiteia judicialmente a devolução integral dos valores investidos acumulada com multa penal coercitiva, ressarcimento por lucros cessantes e danos à imagem institucional.`,
      value: 85000.00,
      lawyers: lawyerListCivil,
      movements: [
        { date: new Date(Date.now() - 30 * 86400000).toISOString(), description: "Distribuição da Ação por dependência eletrônica", source: "Automatizado" },
        { date: new Date(Date.now() - 25 * 86400000).toISOString(), description: "Despacho interlocutório deferindo tutela de urgência para suspensão de protesto cambial", source: "Automatizado" },
        { date: new Date(Date.now() - 15 * 86400000).toISOString(), description: "Ato citatório expedido por via eletrônica direcionado ao Réu", source: "Automatizado" },
        { date: new Date(Date.now() - 2 * 86400000).toISOString(), description: "Juntada de Contestação acompanhada de documentos comprobatórios e Reconvenção autônoma", source: "Automatizado" },
      ]
    });

    // Processo 2: Trabalhista
    const lawyerListWork = ["Dr. Henrique de Arantes Lopes"];
    let cnjWork = "0001423-88.2023.5.02.0045";
    if (isCNJ && cleanQuery !== cnjCivil) cnjWork = cleanQuery;
    else if (isOAB) lawyerListWork.unshift(`Dr(a). ${cleanQuery.toUpperCase()} (OAB)`);
    else lawyerListWork.unshift(`Dr(a). ${cleanQuery}`);

    results.push({
      cnj: cnjWork,
      title: "Reclamação Trabalhista - Reconhecimento de Vínculo e Horas Extras",
      area: "Trabalhista",
      court: "TRT2",
      comarca: "Guarulhos/SP",
      vara: "45ª Vara do Trabalho de Guarulhos",
      description: "Pretensões de natureza trabalhista envolvendo pedido de reconhecimento de vínculo de emprego clandestino de período sem o devido registro formal em carteira de trabalho (CTPS). Pleiteia o pagamento de reflexos legais de horas extraordinárias habituais prestadas, adicional de periculosidade técnica e multas rescisórias dos artigos 467 e 477 da CLT.",
      value: 124000.00,
      lawyers: lawyerListWork,
      movements: [
        { date: new Date(Date.now() - 45 * 86400000).toISOString(), description: "Distribuição e autuação eletrônica da Petição Inicial", source: "Automatizado" },
        { date: new Date(Date.now() - 30 * 86400000).toISOString(), description: "Notificação postal inicial expedida ao Reclamado para comparecimento em Juízo", source: "Automatizado" },
        { date: new Date(Date.now() - 10 * 86400000).toISOString(), description: "Audiência de conciliação realizada sob a égide do rito ordinário, infrutífera em acordo", source: "Automatizado" },
      ]
    });

    // Processo 3: Tributário
    const lawyerListTrib = ["Dr. Fábio de Souza"];
    let cnjTrib = "5003421-90.2023.4.03.6100";
    if (isCNJ && cleanQuery !== cnjCivil && cleanQuery !== cnjWork) cnjTrib = cleanQuery;
    else if (isOAB) lawyerListTrib.unshift(`Patrono OAB ${cleanQuery.toUpperCase()}`);
    else lawyerListTrib.unshift(`Dr(a). ${cleanQuery}`);

    results.push({
      cnj: cnjTrib,
      title: "Mandado de Segurança Coletivo contra Ato da Receita Federal",
      area: "Tributário",
      court: "TRF3",
      comarca: "São Paulo/SP",
      vara: "4ª Vara Cível Federal",
      description: `Medida constitucional impetrada visando anular de imediato ato coator administrativo que determinou cobrança abusiva de alíquota do PIS/COFINS majorada ilegalmente por decreto executivo sem observância ao princípio constitucional da anterioridade nonagesimal (noventena).`,
      value: 320000.00,
      lawyers: lawyerListTrib,
      movements: [
        { date: new Date(Date.now() - 60 * 86400000).toISOString(), description: "Distribuição e sorteio de Relatoria na Subseção Judiciária Federal", source: "Automatizado" },
        { date: new Date(Date.now() - 40 * 86400000).toISOString(), description: "Liminar DEFERIDA inaudita altera parte para suspender a exigibilidade do crédito tributário", source: "Automatizado" },
        { date: new Date(Date.now() - 20 * 86400000).toISOString(), description: "Parecer oficial da Procuradoria da Fazenda Nacional juntado aos autos", source: "Automatizado" },
        { date: new Date(Date.now() - 1 * 86400000).toISOString(), description: "Processo concluso para julgamento de mérito pelo Magistrado titular", source: "Automatizado" },
      ]
    });

    return results;
  }
};
