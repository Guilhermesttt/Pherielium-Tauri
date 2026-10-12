# 12. Drivers: duas janelas "Invalid command line" ao instalar o rc (diagnóstico, somente leitura)

Data: 2026-10-12. Nada foi corrigido. Rótulos: `[VERIFICADO: arquivo:linha ou experimento]` / `[INFERIDO]`.

## Estado: itens 1 e 2 corrigidos no rc.2
O rc.2 corrige a detecção (`ReadRegDWORD`) e os switches (`/exenoui /qn /norestart`) em `hooks.nsh`. Consentimento, código de saída, log e tabela de códigos continuam no backlog. Os switches **não foram executados** contra um bootstrapper (isso instalaria o driver); conferir em máquina sem os drivers.

## Resumo
**Duas falhas independentes no mesmo trecho (`src-tauri/windows/hooks.nsh`), que se somam:**
1. **A checagem "já está instalado?" nunca acerta**: usa `ReadRegStr` num valor `REG_DWORD`, e o NSIS marca erro nesse caso. Resultado: o hook acha que os drivers faltam **mesmo com eles instalados e rodando**, e lança os dois setups em toda instalação.
2. **Os argumentos são de WiX Burn** (`/install /quiet /norestart`), mas os dois setups são bootstrappers do **Advanced Installer**, que não os reconhece: "Invalid command line".

## 1. Onde e como os setups são lançados [VERIFICADO: `hooks.nsh`]
| Item | Valor |
| --- | --- |
| Gatilho | `NSIS_HOOK_POSTINSTALL` (`hooks.nsh:61-65`), depois de gravar o desinstalador; chamado de `installer.nsi` (gerado) dentro de `Section Install` |
| Linha de comando exata | `hooks.nsh:48`: `ExecShellWait "runas" "$INSTDIR\drivers\${ExeName}" "/install /quiet /norestart" SW_HIDE`. Ou seja: `"<INSTDIR>\drivers\ViGEmBusSetup.exe" /install /quiet /norestart` e o mesmo para `HidHideSetup.exe`. Argumentos em uma única string, sem aspas adicionais; o caminho vai como alvo do verbo |
| Ordem | ViGEmBus, depois HidHide (`:63-64`) |
| Diretório de trabalho | o `OutPath` do NSIS, `$INSTDIR` (`SetOutPath $INSTDIR` em `installer.nsi:630`) |
| Elevação | instalador do app é `currentUser` (`tauri.conf.json:52`, `RequestExecutionLevel user`); só o setup do driver é elevado, pelo verbo `runas` (UAC por driver) |
| Janela | `SW_HIDE` esconde a janela do processo, **mas o aviso de erro do bootstrapper é uma caixa de mensagem modal** e aparece mesmo assim; `ExecShellWait` espera ela ser fechada |
| Código de saída | **não é lido**: `ExecShellWait` não o devolve (o próprio comentário do hook diz isso, `:17-19`). O sucesso é decidido só pela chave de serviço depois do setup |
| Quem mais lança setups | **ninguém**. O app só **lê** o estado (`controller_config.rs:150-176`, chave `SYSTEM\CurrentControlSet\Services\HidHide`); não há chamada de `ViGEmBusSetup`/`HidHideSetup` em `src/` nem em `src-tauri/src/` |

## 2. Verificação prévia, consentimento e efeito da falha
- **Existe verificação prévia** (`hooks.nsh:27-37` e `:42`), mas está **quebrada** [VERIFICADO por experimento]. Compilei com o `makensis` do cache do Tauri uma sonda que repete a macro e só **lê** o registro (nada é instalado nem executado; o script está no fim deste arquivo):

  | Variante | `ViGEmBus` | `HidHide` | chave inexistente |
  | --- | --- | --- | --- |
  | `ReadRegStr` (como no hook) | lê `Type=1`, mas `${Errors}` fica verdadeiro, então a macro devolve **"0" (não instalado)** | idem **"0"** | "0" |
  | `ReadRegDWORD` | **"1"** (instalado) | **"1"** | "0" |

  Na máquina do teste os dois serviços existem e estão `Running` (`Type` = `REG_DWORD 0x1`, visível também pela visão de 32 bits: `SysWOW64\reg.exe`). Portanto a falha do registro não é de visão 32/64 bits: é o tipo do valor.
- **Consentimento:** nenhum além do UAC. Não há pergunta, página de opções nem caixa para pular. Em instalação silenciosa (`/S`) o mesmo acontece.
- **Quando o setup falha:** o instalador do app **continua** (só `DetailPrint`, `hooks.nsh:53`); não aborta e não devolve erro.
- **Sem registro de causa:** o sucesso/falha vai só para o painel de detalhes do NSIS; não há log em arquivo.

## 3. Argumentos que os bootstrappers não aceitam
- Os dois `.exe` identificam-se como **Advanced Installer** [VERIFICADO: o texto "Advanced Installer", "exenoui", "Invalid command line", "/qn" e "norestart" existem nos binários, conferido por busca de strings em `HidHideSetup.exe` e `ViGEmBusSetup.exe`]. O assinante é Nefarius Software Solutions e.U. (`drivers:fetch` confere).
- Os switches de **WiX Burn** que o hook usa (`/install`, `/quiet`) **não fazem parte** da linha de comando do bootstrapper do Advanced Installer; o hook foi escrito assumindo Burn (`hooks.nsh:46-47`). A mensagem "Invalid command line" é o texto que o próprio bootstrapper mostra quando recebe parâmetros que não reconhece.
- Os switches do Advanced Installer para o setup EXE, informados por você e coerentes com as strings do binário: **`/exenoui`** (sem interface do bootstrapper), **`/qn`** (instalação silenciosa do MSI embutido) e **`/norestart`**. Fonte: documentação do Advanced Installer, "EXE setup file command line" (advancedinstaller.com/user-guide); [INFERIDO: não consultei a página nesta sessão; a lista vem da sua mensagem e das strings do binário].
- Outras combinações inválidas: `/S` (NSIS) também não existe nesses bootstrappers; `/install` e `/quiet` juntos com `/qn` seriam rejeitados do mesmo modo.

## 4. A falha é inofensiva? Dá para pular o passo?
- **Para quem instala o rc: sim, na prática.** O app é instalado normalmente; os drivers já estavam presentes e o setup que falhou não toca neles. O custo é incômodo: **2 prompts de UAC** e **2 caixas "Invalid command line"** que travam o instalador até alguém fechá-las.
- **Risco real** (não vimos): em uma máquina **sem** os drivers, o setup não instala nada e a emulação de controle fica indisponível até instalar à mão pela aba Controle.
- **Pular no instalador de teste, sem dependência nova:** o hook só instala se `$INSTDIR\drivers\<exe>` existir; senão imprime "instalador não veio no pacote, pulando" (`hooks.nsh:55-56`). Para um rc sem esse passo: **não rode `npm run drivers:fetch`** e remova (ou mova) os dois `.exe` de `src-tauri/windows/drivers/` antes do `tauri build`; a pasta fica só com o `README.md`. Para o instalador **já gerado**, não há como pular: fechar as duas caixas (e cancelar o UAC se aparecer).

## 5. Correção proposta (backlog, NÃO implementada)
1. **Detecção correta:** trocar `ReadRegStr` por `ReadRegDWORD` (provado pela sonda) e validar a presença do `.sys`/serviço; extrair para uma macro com teste (a sonda vira teste de CI do instalador).
2. **Argumentos corretos por bootstrapper:** `/exenoui /qn /norestart` (confirmar uma vez com o comando `/?` de cada setup em máquina de teste, e fixar no `drivers.manifest.json` o campo `silentArgs` junto de `signer`).
3. **Consentimento explícito:** uma pergunta por driver ("O Pherielium usa ViGEmBus e HidHide para a emulação de controle. Instalar agora?") com a opção **Pular**; em instalação silenciosa o padrão é **não instalar**, com switch `/DRIVERS=1` para quem quiser. Lembrar a escolha no updater (não perguntar de novo).
4. **Código de saída de verdade:** executar com `ShellExecuteEx` via o plugin `System` do NSIS (já vem com o NSIS, sem dependência nova) para obter o código, no lugar do `ExecShellWait`.
5. **Tabela de códigos de saída** (códigos padrão do Windows Installer, que os bootstrappers do Advanced Installer repassam; [INFERIDO]):

   | Código | Significado | Ação |
   | --- | --- | --- |
   | 0 | sucesso | confirmar pelo serviço |
   | 3010 | sucesso, reinício necessário | avisar "reinicie o PC para o HidHide funcionar"; não reiniciar sozinho |
   | 1641 | reinício iniciado pelo instalador | idem (não deve ocorrer com `/norestart`) |
   | 1602 | usuário cancelou | mensagem "instalação do driver cancelada; dá para instalar depois pela aba Controle" |
   | 1618 | outra instalação em andamento | pedir para repetir depois |
   | 1603 | erro fatal | mostrar o código e onde está o log |
   | 1625 / 1624 / outros | política do sistema / erro de transformação | mostrar o código |
6. **Mensagem clara e log:** gravar o resultado de cada driver (comando, código, estado do serviço) em arquivo, e mostrar uma linha final: "ViGEmBus: já instalado | HidHide: instalado, reinicie o PC".
7. **Alvo MSI:** continua sem hook (o rc usa só NSIS); decidir se remove o alvo `msi` ou replica a lógica.
8. **Teste:** sonda NSIS de detecção no CI (Windows) e teste manual P-12 em VM limpa (`RESUMO.md`), com e sem os drivers.
- Esforço: 1 a 1,5 dia. Risco: médio (instalador e elevação; testar em VM limpa).

## Anexo: sonda de detecção (somente leitura)
Compilar com `%LOCALAPPDATA%\tauri\NSIS\makensis.exe probe.nsi`, executar `probe.exe` e ler `probe.txt` (fica ao lado do `.exe`). Trocar `ReadRegStr` por `ReadRegDWORD` reproduz a segunda linha da tabela.

```nsis
!include "LogicLib.nsh"
OutFile "probe.exe"
RequestExecutionLevel user
SilentInstall silent

!macro DriverServiceInstalled ServiceName OutVar
  ClearErrors
  ReadRegStr $R9 HKLM "SYSTEM\CurrentControlSet\Services\${ServiceName}" "Type"
  ${If} ${Errors}
    StrCpy ${OutVar} "0"
  ${Else}
    StrCpy ${OutVar} "1"
  ${EndIf}
!macroend

Section
  FileOpen $0 "$EXEDIR\probe.txt" w
  !insertmacro DriverServiceInstalled "ViGEmBus" $R8
  FileWrite $0 "ViGEmBus -> R8=$R8 (R9=$R9)$\r$\n"
  !insertmacro DriverServiceInstalled "HidHide" $R8
  FileWrite $0 "HidHide -> R8=$R8 (R9=$R9)$\r$\n"
  !insertmacro DriverServiceInstalled "NaoExiste" $R8
  FileWrite $0 "NaoExiste -> R8=$R8$\r$\n"
  FileClose $0
SectionEnd
```
