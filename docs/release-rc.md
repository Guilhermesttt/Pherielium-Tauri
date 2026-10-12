# Instalador de teste (release candidate, NSIS)

Procedimento para gerar um instalador **de teste** com DevTools, para validar volume e áudio com duas contas.
**Os dois lados precisam instalar o rc**: o protocolo, o V-fix (`<video>` mudo) e a captura de áudio nativa são do app, não do servidor.

> Quem numera e publica é o dono. Este documento só descreve como gerar e onde achar o arquivo.

## 1. Versão sugerida

`1.0.3-rc.1` (a seguinte `1.0.3-rc.2`, e assim por diante).

Onde alterar (os três devem ficar iguais):

| Arquivo | Campo |
| --- | --- |
| `package.json` | `"version"` |
| `src-tauri/tauri.conf.json` | `"version"` |
| `src-tauri/Cargo.toml` | `version` em `[package]` |

Fatos que importam (conferidos no código):

- **Só NSIS.** O MSI (WiX) não aceita sufixo `-rc.1` na versão; por isso o comando abaixo usa `--bundles nsis`.
- O verificador de atualização (`src/services/githubUpdater.ts`, `parseSemver`) **ignora o sufixo**: `1.0.3-rc.1` conta como `1.0.3`.
  Consequência: quem instala o rc **não é avisado** da versão final `1.0.3`. Para o aviso aparecer, a final tem que ser `1.0.4` (ou reinstale à mão).
- **Não publique o rc no GitHub.** O app lê a lista de releases e pega a primeira que não seja rascunho (`githubUpdater.ts:~160`), então até uma pre-release seria oferecida a todos os usuários de 1.0.2. **Envie o `.exe` direto** às pessoas do teste.
- A versão final será **1.0.4** (não 1.0.3), pelo motivo do sufixo acima.

## 2. Gerar

Na raiz do repositório, em um PowerShell:

```powershell
npm ci
npm run drivers:fetch          # baixa os drivers que o instalador embarca (resources: windows/drivers/*)
npm run tauri build -- --features devtools --bundles nsis
```

- `--features devtools` liga a feature opcional `devtools` de `src-tauri/Cargo.toml` (repassa `tauri/devtools`). **O instalador oficial não usa essa feature.**
- A primeira compilação de release (LTO) leva vários minutos.

### O que `drivers:fetch` valida hoje (`scripts/fetch-drivers.mjs`, `scripts/drivers.manifest.json`)
| Verificação | Estado |
| --- | --- |
| Versões fixas | **Sim**: ViGEmBus 1.22.0 e HidHide 1.5.230.0, por URL de release do GitHub |
| SHA-256 | **Sim**: se o arquivo baixado não bater, o script apaga o arquivo e sai com erro; arquivo já baixado só é reaproveitado se o hash bater |
| Assinatura digital (Authenticode) | **Sim, no Windows** (`scripts/driverSignature.mjs`, via `Get-AuthenticodeSignature` do PowerShell, sem dependência nova). Exige status `Valid` e CN do certificado **igual** ao campo `signer` do manifesto (Nefarius Software Solutions e.U.). Reprovou, ou o PowerShell falhou: o arquivo é removido e o script sai com erro. **Fora do Windows** não há como verificar: o script avisa "assinatura NÃO verificada" e segue com o SHA-256; com `DRIVERS_REQUIRE_SIGNATURE=1` isso vira erro |
| Execução do instalador | O instalador NSIS embarca os arquivos; o hook `windows/hooks.nsh` os executa na instalação |

Conferência manual, se quiser: `Get-AuthenticodeSignature src-tauri\windows\drivers\*.exe | Format-List Status, SignerCertificate`.
Testes: `scripts/driverSignature.test.mjs` (decisão pura, falha segura e comportamento fora do Windows).

## 3. Onde fica o arquivo

`src-tauri/target/release/bundle/nsis/Pherielium_1.0.3-rc.1_x64-setup.exe`

(`target/` está no `.gitignore`. As pastas `release/` e `dist-installers/` da raiz são de builds antigos e também ignoradas; não use.)

**SmartScreen:** o instalador não é assinado com certificado de código e é novo, então o Windows mostra "O Windows protegeu o computador". Quem instala clica em **Mais informações > Executar assim mesmo**. Avise as pessoas antes de enviar o arquivo e passe o SHA-256 do `.exe` (`Get-FileHash <arquivo>`) para que confiram que é o mesmo.

Instalação é por usuário (`installMode: currentUser`), sem pedir administrador para o app; os drivers opcionais são tratados pelo hook `src-tauri/windows/hooks.nsh`.
Não há auto-update configurado (`plugins.updater` vazio), então **a primeira instalação e as trocas de rc são manuais**.
Para voltar à versão oficial: desinstale o rc e instale a 1.0.2.

## 4. Abrir o DevTools no build de teste

Com o rc instalado (feature `devtools`): **F12** ou **Ctrl+Shift+I** na janela principal, ou botão direito > Inspecionar.
Se nenhuma das teclas abrir, o build foi gerado **sem** `--features devtools`; refaça o passo 2.

No console:

```js
localStorage.setItem("pherielium_stream_debug", "1")   // liga o inventário de áudio e os diagnósticos de transmissão
// reinicie o app, entre na chamada e rode:
await window.pherieliumAudioInventory()
await window.pherieliumGuardReport()
await window.pherieliumCallFailures()
```

Os relatórios mostram UIDs só com 4 caracteres, então podem ser colados sem expor dados.

## 5. Testes de aceite

Estão em `docs/backend-audit/09-v-volume-transmissao.md` (seção "Aceite manual do V-fix") e em `docs/backend-audit/08-f0-audio-ativacao.md` (P-10, áudio do PC na transmissão).
