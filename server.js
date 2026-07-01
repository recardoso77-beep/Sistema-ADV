// Arquivo de inicialização para servidores que exigem arquivo na raiz (como cPanel / Plesk)
// Redireciona a execução para o servidor empacotado na pasta dist

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function start() {
  const serverCjsPath = path.join(__dirname, 'dist', 'server.cjs');

  // Se o build não existir, vamos tentar rodar o build automaticamente!
  if (!fs.existsSync(serverCjsPath)) {
    console.log("Pasta 'dist/' não encontrada ou incompleta. Iniciando compilação automática no cPanel...");
    try {
      // Tenta rodar o npm run build na pasta atual
      execSync('npm run build', { stdio: 'inherit', cwd: __dirname });
      console.log("Compilação automática concluída com sucesso!");
    } catch (buildErr) {
      console.error("Falha ao compilar automaticamente usando 'npm run build':", buildErr);
    }
  }

  try {
    await import('./dist/server.cjs');
  } catch (err) {
    console.error("Erro ao carregar o servidor principal (dist/server.cjs).");
    console.error(err);
    
    // Se a pasta dist não foi gerada ou ocorreu outro erro, iniciamos um servidor mínimo para orientar o usuário
    try {
      const expressModule = await import('express');
      const express = expressModule.default;
      const app = express();
      const port = process.env.PORT || 3000;
      
      app.get('*', (req, res) => {
        res.status(503).send(`
          <div style="font-family: sans-serif; padding: 40px; max-width: 650px; margin: 40px auto; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); background-color: #fff;">
            <div style="text-align: center; margin-bottom: 24px;">
              <span style="font-size: 48px;">⚠️</span>
              <h2 style="color: #dc2626; margin-top: 12px; margin-bottom: 4px;">Legal Prime ERP - Erro de Inicialização</h2>
              <p style="color: #64748b; margin: 0; font-size: 14px;">Falta de arquivos compilados (Pasta dist/ não encontrada)</p>
            </div>
            
            <p>Olá! O sistema foi enviado para o seu servidor, mas o <strong>servidor de produção (dist/server.cjs)</strong> não pôde ser iniciado ou compilado automaticamente.</p>
            
            <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0; border-radius: 4px;">
              <h4 style="margin: 0 0 8px 0; color: #1e3a8a;">Como corrigir este problema sem Terminal:</h4>
              <ol style="margin: 0; padding-left: 20px; color: #334155; font-size: 14px; line-height: 1.8;">
                <li>No seu painel do cPanel, clique no botão <strong>"Executar a instalação do NPM"</strong> (NPM Install) para garantir que todas as ferramentas estão instaladas.</li>
                <li>Clique em <strong>"REINICIAR"</strong> (Restart) no painel do cPanel. O sistema tentará compilar os arquivos automaticamente novamente.</li>
              </ol>
            </div>
            
            <p style="font-size: 14px; color: #475569;">Isso gerará os arquivos otimizados para produção na pasta <code style="font-family: monospace;">dist/</code>, permitindo que o sistema inicie perfeitamente.</p>
            
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="font-size: 12px; color: #94a3b8; font-family: monospace; word-break: break-all;">Detalhes técnicos do erro: ${err.message}</p>
          </div>
        `);
      });
      
      app.listen(port, () => {
        console.log(`Servidor de fallback rodando na porta ${port}`);
      });
    } catch (expressErr) {
      console.error("Não foi possível carregar o Express para o servidor de fallback:", expressErr);
    }
  }
}

start();
