# Decisões de arquitetura (ADRs)

| Nº | Título | Estado |
| --- | --- | --- |
| 0001 | Realtime privado e convivência de versões | proposta |
| 0002 | Presença com TTL no servidor e atividade separada | proposta |
| 0003 | Estado do jogo com fonte única no Rust | proposta |
| 0004 | Chamada 1:1 com sessão autoritativa | **será substituída** pela decisão "1:1 como canal efêmero de 2 pessoas" (fatia I, depois dos canais) |
| 0005 | Token do LiveKit fora do Render | proposta (backlog) |
| 0006 | Chamada sem fallback P2P silencioso | aceita (D1) |
| 0007 | Convite como mensagem validado no servidor | proposta (I) |
| 0008 | Canais de voz privados salvos | proposta (R) |
| 0009 | Remoção do ciclo de chamada antigo | proposta (I-2, depois do corte do v1) |
| 0010 | Updater do Tauri assinado | **reservado** (fatia U, backlog); ainda sem arquivo |

## Reconciliação da numeração

O plano original (PLAN §15.2) reservava **0007** para o updater. Ao planejar I e R, os números 0007 a 0009 foram usados por convite, canais salvos e remoção do ciclo antigo, e o updater passou para **0010** (PLAN §17.10).
Mapa para quem lê documentos antigos:

| Texto antigo diz | Vale hoje |
| --- | --- |
| "updater, ADR 0007" (PLAN §15.2, PROGRESSO) | ADR **0010** (reservada) |
| "ADR 0007" em contexto de convite | ADR 0007 (convite como mensagem) |
| "ADR-0004" como caminho do 1:1 | substituída pelo 1:1 como canal efêmero (fatia I) |

Regra daqui em diante: o número só é consumido quando o arquivo é criado nesta pasta.
