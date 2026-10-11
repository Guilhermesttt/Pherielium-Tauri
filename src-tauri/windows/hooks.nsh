; Instalação dos drivers de controle junto com o Pherielium.
;
; ViGEmBus cria o gamepad Xbox 360 virtual; HidHide esconde o controle físico
; do jogo. Sem o HidHide o jogo lê os dois ao mesmo tempo e a entrada chega
; duplicada, então os dois andam juntos — é por isso que a emulação só habilita
; com ambos presentes (ver controller_config.rs).
;
; Decisões:
;  - O instalador do app continua `currentUser` (não pede admin, não muda o
;    diretório, não quebra o updater de quem já tem o app instalado). Só o
;    instalador do DRIVER é elevado, via "runas", e só quando o driver falta:
;    quem já tem os dois não vê UAC nenhum.
;  - Só instala o que falta. Quem já tem (DS4Windows, Steam, instalação manual)
;    não é tocado.
;  - NUNCA desinstala. Os dois drivers são compartilhados com outros programas;
;    removê-los no uninstall do Pherielium quebraria esses programas.
;  - O resultado é conferido pela chave de serviço, não pelo código de saída:
;    ExecShellWait não devolve o código, e o código de um bundle não diz se o
;    driver de fato ficou registrado.
;  - Falha em qualquer driver NÃO aborta a instalação do app. Sem driver o
;    launcher funciona; só a emulação fica indisponível e a aba de controle
;    guia a instalação manual.
;
; Os .exe vêm de `npm run drivers:fetch` (versão e SHA-256 fixados em
; scripts/drivers.manifest.json) e entram pelo bundle.resources.

!macro DriverServiceInstalled ServiceName OutVar
  ; Mesmo sinal que o app usa em hidhide_status(). Abrir o device como arquivo
  ; não serve: dá falso negativo com o driver instalado e rodando.
  ClearErrors
  ReadRegStr $R9 HKLM "SYSTEM\CurrentControlSet\Services\${ServiceName}" "Type"
  ${If} ${Errors}
    StrCpy ${OutVar} "0"
  ${Else}
    StrCpy ${OutVar} "1"
  ${EndIf}
!macroend

!macro InstallDriverIfMissing DisplayName ServiceName ExeName
  Push $R8
  !insertmacro DriverServiceInstalled "${ServiceName}" $R8
  ${If} $R8 == "1"
    DetailPrint "${DisplayName}: já instalado, mantendo como está."
  ${ElseIf} ${FileExists} "$INSTDIR\drivers\${ExeName}"
    DetailPrint "Instalando ${DisplayName} (pede permissão de administrador)..."
    ; "runas" eleva só este processo. Bundles WiX Burn aceitam /install /quiet
    ; /norestart; o reinício fica a cargo do usuário, nunca da máquina.
    ExecShellWait "runas" "$INSTDIR\drivers\${ExeName}" "/install /quiet /norestart" SW_HIDE
    !insertmacro DriverServiceInstalled "${ServiceName}" $R8
    ${If} $R8 == "1"
      DetailPrint "${DisplayName}: instalado."
    ${Else}
      DetailPrint "${DisplayName}: não foi instalado (permissão negada ou falha). Dá para instalar depois pela aba Controle."
    ${EndIf}
  ${Else}
    DetailPrint "${DisplayName}: instalador não veio no pacote, pulando."
  ${EndIf}
  Pop $R8
!macroend

!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "Verificando drivers de controle..."
  !insertmacro InstallDriverIfMissing "ViGEmBus" "ViGEmBus" "ViGEmBusSetup.exe"
  !insertmacro InstallDriverIfMissing "HidHide" "HidHide" "HidHideSetup.exe"
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ; De propósito vazio. ViGEmBus e HidHide são compartilhados com outros
  ; programas (DS4Windows, Steam, reWASD); removê-los aqui quebraria todos eles.
  ; Quem quiser remover usa Aplicativos e Recursos do Windows.
!macroend
