//! Captura WASAPI no Windows: process loopback (excluir/incluir uma árvore de
//! processos) e loopback do dispositivo padrão.
//!
//! Todo o `unsafe` da captura mora aqui, em blocos pequenos com a invariante
//! que os sustenta escrita ao lado.
//!
//! Um cliente de áudio ativado por process loopback NÃO suporta `GetMixFormat`
//! (a Microsoft exige informar o formato). Por isso o formato é fixo
//! (`format.rs`) e o `Initialize` tenta uma lista de combinações até uma ser
//! aceita. Depois de um `Initialize` recusado o cliente fica inutilizável, então
//! cada tentativa ativa um cliente novo.

use std::ffi::c_void;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::mpsc;
use std::time::Duration;

use windows::core::{Interface, GUID, HRESULT, IUnknown, PCWSTR};
use windows::Win32::Foundation::{CloseHandle, BOOL, HANDLE, WAIT_OBJECT_0};
use windows::Win32::Media::Audio::{
    eConsole, eRender, ActivateAudioInterfaceAsync, IActivateAudioInterfaceCompletionHandler,
    IActivateAudioInterfaceCompletionHandler_Vtbl, IAudioCaptureClient, IAudioClient,
    IMMDeviceEnumerator, MMDeviceEnumerator, AUDCLNT_SHAREMODE_SHARED,
    AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM, AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
    AUDCLNT_STREAMFLAGS_LOOPBACK, AUDCLNT_STREAMFLAGS_SRC_DEFAULT_QUALITY,
    AUDIOCLIENT_ACTIVATION_PARAMS, AUDIOCLIENT_ACTIVATION_PARAMS_0,
    AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK, AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS,
    PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE,
    PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE, VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK,
    WAVEFORMATEX,
};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_MULTITHREADED,
};
use windows::Win32::System::Threading::{CreateEventW, WaitForSingleObject};

use super::error::AudioCaptureError;
use super::format::{
    decode_into, SampleFormat, CHANNELS, SAMPLE_RATE,
};
use super::source::{
    AudioCaptureSource, Capability, CaptureStream, ReadOutcome, Strategy,
    MIN_PROCESS_LOOPBACK_BUILD,
};

const WAVE_FORMAT_PCM: u16 = 1;
const WAVE_FORMAT_IEEE_FLOAT: u16 = 3;
const AUDCLNT_BUFFERFLAGS_SILENT: u32 = 0x2;
/// `AUDCLNT_E_DEVICE_INVALIDATED`: o dispositivo foi removido ou trocado.
const AUDCLNT_E_DEVICE_INVALIDATED: u32 = 0x8889_0004;
/// Buffer pedido ao `Initialize`, em unidades de 100 ns (20 ms).
const BUFFER_DURATION_HNS: i64 = 200_000;
/// Teto de pacotes drenados por `read`, para nunca prender a thread.
const MAX_PACKETS_PER_READ: usize = 64;
const ACTIVATION_TIMEOUT: Duration = Duration::from_secs(3);

fn hr(err: &windows::core::Error) -> u32 {
    err.code().0 as u32
}

fn api(call: &'static str) -> impl Fn(windows::core::Error) -> AudioCaptureError {
    move |e| {
        let hresult = hr(&e);
        if hresult == AUDCLNT_E_DEVICE_INVALIDATED {
            AudioCaptureError::DeviceInvalidated
        } else {
            AudioCaptureError::Windows { call, hresult }
        }
    }
}

// ── COM por thread ──────────────────────────────────────────────────────────

/// Inicializa o COM na thread e desfaz ao sair. Só desfaz se este guard foi
/// quem inicializou com sucesso (S_OK ou S_FALSE).
struct ComGuard {
    initialized: bool,
}

impl ComGuard {
    fn init() -> Self {
        // SAFETY: chamada simples de inicialização do COM para a thread atual.
        let initialized = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) }.is_ok();
        Self { initialized }
    }
}

impl Drop for ComGuard {
    fn drop(&mut self) {
        if self.initialized {
            // SAFETY: pareia o CoInitializeEx bem-sucedido deste mesmo guard.
            unsafe { CoUninitialize() };
        }
    }
}

// ── Formato ─────────────────────────────────────────────────────────────────

fn wave_format(format: SampleFormat) -> WAVEFORMATEX {
    let bits = format.bits();
    let block_align = CHANNELS * bits / 8;
    WAVEFORMATEX {
        wFormatTag: match format {
            SampleFormat::F32 => WAVE_FORMAT_IEEE_FLOAT,
            SampleFormat::S16 => WAVE_FORMAT_PCM,
        },
        nChannels: CHANNELS,
        nSamplesPerSec: SAMPLE_RATE,
        nAvgBytesPerSec: SAMPLE_RATE * block_align as u32,
        nBlockAlign: block_align,
        wBitsPerSample: bits,
        cbSize: 0,
    }
}

/// Combinações tentadas no `Initialize`, em ordem. O conversor do WASAPI
/// (`AUTOCONVERTPCM`) é preferido porque o dispositivo real raramente está em
/// 48 kHz estéreo float; a última linha é a forma "pura" do exemplo da Microsoft.
const INIT_ATTEMPTS: [(SampleFormat, u32); 4] = [
    (SampleFormat::F32, FLAGS_CONVERT),
    (SampleFormat::S16, FLAGS_CONVERT),
    (SampleFormat::F32, FLAGS_PLAIN),
    (SampleFormat::S16, FLAGS_PLAIN),
];

const FLAGS_PLAIN: u32 = AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_EVENTCALLBACK;
const FLAGS_CONVERT: u32 =
    FLAGS_PLAIN | AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM | AUDCLNT_STREAMFLAGS_SRC_DEFAULT_QUALITY;

// ── Ativação por process loopback ───────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LoopbackScope {
    /// Tudo, menos este PID e seus filhos (inclui o WebView2 do app).
    ExcludeTree(u32),
    /// Só este PID e seus filhos.
    IncludeTree(u32),
}

/// Layout de um PROPVARIANT do tipo VT_BLOB, como o Windows espera.
#[repr(C)]
struct ActivationBlob {
    vt: u16,
    reserved1: u16,
    reserved2: u16,
    reserved3: u16,
    size: u32,
    data: *const AUDIOCLIENT_ACTIVATION_PARAMS,
}

/// Objeto COM mínimo que avisa quando a ativação assíncrona termina.
#[repr(C)]
struct Handler {
    vtbl: *const IActivateAudioInterfaceCompletionHandler_Vtbl,
    ref_count: AtomicU32,
    tx: std::sync::Mutex<Option<mpsc::Sender<()>>>,
}

unsafe extern "system" fn handler_query_interface(
    this: *mut c_void,
    iid: *const GUID,
    out: *mut *mut c_void,
) -> HRESULT {
    const E_POINTER: HRESULT = HRESULT(0x8000_4003u32 as i32);
    const E_NOINTERFACE: HRESULT = HRESULT(0x8000_4002u32 as i32);
    if iid.is_null() || out.is_null() {
        return E_POINTER;
    }
    // SAFETY: `iid` e `out` foram verificados como não nulos acima.
    let iid = unsafe { *iid };
    let iunknown = GUID::from_u128(0x0000_0000_0000_0000_c000_0000_0000_0046);
    let wanted = <IActivateAudioInterfaceCompletionHandler as Interface>::IID;
    // IAgileObject {94ea2b94-e9cc-49e0-c0ff-ee64ca8f5b90}. O ActivateAudioInterfaceAsync
    // chama o handler de uma thread do próprio Windows e exige que ele seja
    // "agile" (no exemplo da Microsoft é o `FtmBase`); sem responder a esta
    // interface a ativação falha com E_ILLEGAL_METHOD_CALL (0x8000000E).
    // O handler É seguro entre threads: só usa atômicos e um Mutex.
    let agile = GUID::from_u128(0x94ea2b94_e9cc_49e0_c0ff_ee64ca8f5b90);
    if iid == iunknown || iid == wanted || iid == agile {
        // SAFETY: `this` aponta para um `Handler` vivo (ver `activate`); o AddRef
        // mantém o objeto vivo para quem recebe o ponteiro.
        unsafe {
            *out = this;
            handler_add_ref(this);
        }
        HRESULT(0)
    } else {
        // SAFETY: `out` não é nulo.
        unsafe { *out = std::ptr::null_mut() };
        E_NOINTERFACE
    }
}

unsafe extern "system" fn handler_add_ref(this: *mut c_void) -> u32 {
    // SAFETY: `this` é um `Handler` vivo enquanto o contador for > 0.
    let handler = unsafe { &*(this as *const Handler) };
    handler.ref_count.fetch_add(1, Ordering::SeqCst) + 1
}

unsafe extern "system" fn handler_release(this: *mut c_void) -> u32 {
    // SAFETY: idem `handler_add_ref`.
    let handler = unsafe { &*(this as *const Handler) };
    let next = handler.ref_count.fetch_sub(1, Ordering::SeqCst) - 1;
    if next == 0 {
        // SAFETY: o contador chegou a zero: ninguém mais referencia o objeto, que
        // foi criado por `Box::into_raw` em `activate`.
        unsafe { drop(Box::from_raw(this as *mut Handler)) };
    }
    next
}

unsafe extern "system" fn handler_activate_completed(
    this: *mut c_void,
    _operation: *mut c_void,
) -> HRESULT {
    // SAFETY: `this` é um `Handler` vivo (o Windows segura uma referência até chamar isto).
    let handler = unsafe { &*(this as *const Handler) };
    if let Some(tx) = handler.tx.lock().ok().and_then(|mut slot| slot.take()) {
        let _ = tx.send(());
    }
    HRESULT(0)
}

static HANDLER_VTBL: IActivateAudioInterfaceCompletionHandler_Vtbl =
    IActivateAudioInterfaceCompletionHandler_Vtbl {
        base__: windows::core::IUnknown_Vtbl {
            QueryInterface: handler_query_interface,
            AddRef: handler_add_ref,
            Release: handler_release,
        },
        ActivateCompleted: handler_activate_completed,
    };

/// Ativa um `IAudioClient` de process loopback. Ainda NÃO inicializado.
fn activate(scope: LoopbackScope) -> Result<IAudioClient, AudioCaptureError> {
    let (pid, mode) = match scope {
        LoopbackScope::ExcludeTree(pid) => (pid, PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE),
        LoopbackScope::IncludeTree(pid) => (pid, PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE),
    };

    let params = AUDIOCLIENT_ACTIVATION_PARAMS {
        ActivationType: AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK,
        Anonymous: AUDIOCLIENT_ACTIVATION_PARAMS_0 {
            ProcessLoopbackParams: AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS {
                TargetProcessId: pid,
                ProcessLoopbackMode: mode,
            },
        },
    };
    // `params` precisa viver até `ActivateAudioInterfaceAsync` terminar: o blob
    // só guarda um ponteiro para ele, e ambos ficam neste quadro de pilha.
    let blob = ActivationBlob {
        vt: 65, // VT_BLOB
        reserved1: 0,
        reserved2: 0,
        reserved3: 0,
        size: std::mem::size_of::<AUDIOCLIENT_ACTIVATION_PARAMS>() as u32,
        data: &params,
    };

    let (ready_tx, ready_rx) = mpsc::channel();
    let raw = Box::into_raw(Box::new(Handler {
        vtbl: &HANDLER_VTBL,
        ref_count: AtomicU32::new(1),
        tx: std::sync::Mutex::new(Some(ready_tx)),
    }));
    // SAFETY: `raw` veio de `Box::into_raw` e começa com a vtable esperada
    // (`#[repr(C)]`, vtbl primeiro). `from_raw` assume a referência inicial (1)
    // e a libera pelo `Release` quando `handler` cair.
    let handler = unsafe { IActivateAudioInterfaceCompletionHandler::from_raw(raw.cast::<c_void>()) };

    // SAFETY: `blob` é um VT_BLOB válido que aponta para `params`; ambos vivem
    // até o fim da função, e a chamada só os lê durante a ativação.
    let operation = unsafe {
        ActivateAudioInterfaceAsync(
            VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK,
            &IAudioClient::IID,
            Some(&blob as *const ActivationBlob as *const windows::core::PROPVARIANT),
            &handler,
        )
    }
    .map_err(api("ActivateAudioInterfaceAsync"))?;

    ready_rx
        .recv_timeout(ACTIVATION_TIMEOUT)
        .map_err(|_| AudioCaptureError::ActivationTimeout)?;

    let mut activate_hr = HRESULT(0);
    let mut unknown: Option<IUnknown> = None;
    // SAFETY: a operação terminou (o handler avisou); os dois ponteiros de saída
    // são variáveis locais válidas.
    unsafe { operation.GetActivateResult(&mut activate_hr, &mut unknown) }
        .map_err(api("GetActivateResult"))?;
    if activate_hr.is_err() {
        return Err(AudioCaptureError::ActivationFailed { hresult: activate_hr.0 as u32 });
    }
    let unknown = unknown.ok_or(AudioCaptureError::ActivationFailed { hresult: 0x8000_4005 })?;
    unknown.cast::<IAudioClient>().map_err(api("IAudioClient::cast"))
}

/// Cliente de loopback do dispositivo de saída padrão (ouve TUDO, inclusive a call).
fn activate_default_render() -> Result<IAudioClient, AudioCaptureError> {
    // SAFETY: criação padrão do enumerador; COM já inicializado pela thread.
    let enumerator: IMMDeviceEnumerator =
        unsafe { CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL) }
            .map_err(api("MMDeviceEnumerator"))?;
    // SAFETY: chamadas COM sobre objetos vivos e ponteiros de saída válidos.
    let device = unsafe { enumerator.GetDefaultAudioEndpoint(eRender, eConsole) }
        .map_err(api("GetDefaultAudioEndpoint"))?;
    // SAFETY: idem.
    unsafe { device.Activate::<IAudioClient>(CLSCTX_ALL, None) }.map_err(api("Activate"))
}

// ── Stream aberta ───────────────────────────────────────────────────────────

struct WinStream {
    client: IAudioClient,
    capture: IAudioCaptureClient,
    event: HANDLE,
    format: SampleFormat,
    block_align: usize,
    /// Por último: o COM só é desfeito depois de soltar o cliente e a captura.
    _com: ComGuard,
}

impl WinStream {
    /// Ativa, inicializa com a primeira combinação aceita e inicia a captura.
    fn open(
        activate_client: &dyn Fn() -> Result<IAudioClient, AudioCaptureError>,
    ) -> Result<(Self, SampleFormat, u32), AudioCaptureError> {
        let com = ComGuard::init();
        let mut last = AudioCaptureError::FormatRejected { format: "f32", hresult: 0 };

        for (format, flags) in INIT_ATTEMPTS {
            let client = activate_client()?;
            let wfx = wave_format(format);
            // SAFETY: `wfx` é válido e vive durante a chamada; `None` = GUID de sessão padrão.
            let init = unsafe {
                client.Initialize(
                    AUDCLNT_SHAREMODE_SHARED,
                    flags,
                    BUFFER_DURATION_HNS,
                    0,
                    &wfx,
                    None,
                )
            };
            if let Err(e) = init {
                last = AudioCaptureError::FormatRejected { format: format.name(), hresult: hr(&e) };
                continue;
            }

            // SAFETY: handle de evento auto-reset sem nome; é fechado em `Drop`.
            let event = unsafe { CreateEventW(None, BOOL(0), BOOL(0), PCWSTR::null()) }
                .map_err(api("CreateEventW"))?;
            // SAFETY: `event` é um handle válido que vive tanto quanto `client`.
            unsafe { client.SetEventHandle(event) }.map_err(|e| {
                // SAFETY: `event` acabou de ser criado e ainda não foi movido.
                unsafe { let _ = CloseHandle(event); }
                api("SetEventHandle")(e)
            })?;
            // SAFETY: `client` foi inicializado acima.
            let capture: IAudioCaptureClient = unsafe { client.GetService() }.map_err(|e| {
                // SAFETY: idem.
                unsafe { let _ = CloseHandle(event); }
                api("GetService")(e)
            })?;
            // SAFETY: `client` está inicializado e com evento configurado.
            unsafe { client.Start() }.map_err(|e| {
                // SAFETY: idem.
                unsafe { let _ = CloseHandle(event); }
                api("Start")(e)
            })?;

            let block_align = (CHANNELS as usize) * format.bytes_per_sample();
            let attempt_flags = flags;
            return Ok((
                WinStream { client, capture, event, format, block_align, _com: com },
                format,
                attempt_flags,
            ));
        }
        Err(last)
    }

    fn drain(&mut self, out: &mut Vec<f32>) -> Result<(), AudioCaptureError> {
        for _ in 0..MAX_PACKETS_PER_READ {
            // SAFETY: `capture` é um IAudioCaptureClient vivo e já iniciado.
            let packet = unsafe { self.capture.GetNextPacketSize() }
                .map_err(api("GetNextPacketSize"))?;
            if packet == 0 {
                return Ok(());
            }

            let mut data: *mut u8 = std::ptr::null_mut();
            let mut frames: u32 = 0;
            let mut flags: u32 = 0;
            // SAFETY: ponteiros de saída são variáveis locais; o buffer devolvido
            // vale até o `ReleaseBuffer` abaixo.
            unsafe { self.capture.GetBuffer(&mut data, &mut frames, &mut flags, None, None) }
                .map_err(api("GetBuffer"))?;

            if frames > 0 {
                let samples = frames as usize * CHANNELS as usize;
                if flags & AUDCLNT_BUFFERFLAGS_SILENT != 0 || data.is_null() {
                    out.extend(std::iter::repeat_n(0.0f32, samples));
                } else {
                    // SAFETY: o WASAPI garante `frames * nBlockAlign` bytes legíveis
                    // em `data` até o `ReleaseBuffer`; a fatia não escapa deste bloco.
                    let bytes = unsafe {
                        std::slice::from_raw_parts(data, frames as usize * self.block_align)
                    };
                    decode_into(bytes, self.format, out);
                }
            }
            // SAFETY: devolve exatamente o buffer obtido acima.
            unsafe { self.capture.ReleaseBuffer(frames) }.map_err(api("ReleaseBuffer"))?;
        }
        Ok(())
    }
}

impl CaptureStream for WinStream {
    fn read(
        &mut self,
        timeout: Duration,
        out: &mut Vec<f32>,
    ) -> Result<ReadOutcome, AudioCaptureError> {
        let millis = timeout.as_millis().min(u32::MAX as u128) as u32;
        // SAFETY: `event` é um handle válido deste stream.
        let waited = unsafe { WaitForSingleObject(self.event, millis) };
        // Drena mesmo no timeout: loopback em silêncio pode não sinalizar o evento.
        let before = out.len();
        self.drain(out)?;
        if waited == WAIT_OBJECT_0 || out.len() > before {
            Ok(ReadOutcome::Data)
        } else {
            Ok(ReadOutcome::Timeout)
        }
    }
}

impl Drop for WinStream {
    fn drop(&mut self) {
        // SAFETY: `client` foi iniciado em `open`; parar um cliente já parado é inofensivo.
        unsafe {
            let _ = self.client.Stop();
            let _ = CloseHandle(self.event);
        }
    }
}

// ── Fontes ──────────────────────────────────────────────────────────────────

pub struct ProcessLoopbackSource {
    scope: LoopbackScope,
}

impl ProcessLoopbackSource {
    pub fn new(scope: LoopbackScope) -> Self {
        Self { scope }
    }
}

impl AudioCaptureSource for ProcessLoopbackSource {
    fn strategy(&self) -> Strategy {
        match self.scope {
            LoopbackScope::ExcludeTree(_) => Strategy::ExcludeOwnProcessTree,
            LoopbackScope::IncludeTree(_) => Strategy::IncludeTargetProcessTree,
        }
    }

    fn open(&mut self) -> Result<Box<dyn CaptureStream>, AudioCaptureError> {
        let scope = self.scope;
        let (stream, format, flags) = WinStream::open(&|| activate(scope))?;
        eprintln!(
            "[audio-capture] {:?} aberto: {} 48k estéreo, flags={flags:#x}",
            self.strategy(),
            format.name()
        );
        Ok(Box::new(stream))
    }
}

pub struct SystemLoopbackSource;

impl AudioCaptureSource for SystemLoopbackSource {
    fn strategy(&self) -> Strategy {
        Strategy::SystemLoopback
    }

    fn open(&mut self) -> Result<Box<dyn CaptureStream>, AudioCaptureError> {
        let (stream, format, flags) = WinStream::open(&activate_default_render)?;
        eprintln!(
            "[audio-capture] SystemLoopback aberto: {} 48k estéreo, flags={flags:#x}",
            format.name()
        );
        Ok(Box::new(stream))
    }
}

// ── Sonda de capacidade ─────────────────────────────────────────────────────

/// Número do build do Windows, lido do registro (`CurrentBuildNumber`).
pub fn windows_build() -> Option<u32> {
    use winreg::enums::HKEY_LOCAL_MACHINE;
    use winreg::RegKey;
    RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey(r"SOFTWARE\Microsoft\Windows NT\CurrentVersion")
        .ok()?
        .get_value::<String, _>("CurrentBuildNumber")
        .ok()?
        .trim()
        .parse()
        .ok()
}

/// Descobre se o process loopback funciona nesta máquina TENTANDO ativar.
///
/// O resultado da ativação manda: um build abaixo do mínimo oficial que
/// funcione não é bloqueado à toa. O número do build só serve para explicar a
/// falha quando ela acontece.
pub fn probe_capability() -> Capability {
    let probe = std::thread::Builder::new()
        .name("audio-capability-probe".into())
        .spawn(|| {
            let _com = ComGuard::init();
            // O PID é irrelevante para a sonda: só queremos saber se o Windows ativa.
            activate(LoopbackScope::ExcludeTree(std::process::id())).map(|_| ())
        });

    let outcome = match probe.map(|h| h.join()) {
        Ok(Ok(result)) => result,
        _ => Err(AudioCaptureError::ActivationFailed { hresult: 0x8000_4005 }),
    };

    match outcome {
        Ok(()) => Capability::Supported,
        Err(err) => {
            let hresult = match err {
                AudioCaptureError::ActivationFailed { hresult }
                | AudioCaptureError::Windows { hresult, .. } => hresult,
                _ => 0x8000_4005,
            };
            match windows_build() {
                Some(found) if found < MIN_PROCESS_LOOPBACK_BUILD => {
                    Capability::UnsupportedBuild { found }
                }
                _ => Capability::ActivationFailed { hresult },
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// PASSO 0 do plano: confirma, nesta máquina, se um cliente de process
    /// loopback aceita `GetMixFormat`. A hipótese é que NÃO (E_NOTIMPL), e é por
    /// isso que a captura antiga nunca começava. `ignore` porque depende do
    /// Windows e do áudio da máquina.
    ///
    /// `cargo test --lib getmixformat_on_process_loopback -- --ignored --nocapture`
    #[test]
    #[ignore = "depende do Windows e do áudio desta máquina"]
    fn getmixformat_on_process_loopback() {
        let _com = ComGuard::init();
        let client = activate(LoopbackScope::ExcludeTree(std::process::id()))
            .expect("a ativação por process loopback deveria funcionar");
        // SAFETY: `client` é um IAudioClient vivo; só lemos o HRESULT.
        let result = unsafe { client.GetMixFormat() };
        match result {
            Ok(ptr) => {
                println!("GetMixFormat: OK ({ptr:?}) — hipótese REFUTADA");
                // SAFETY: ponteiro devolvido pelo próprio WASAPI.
                unsafe { windows::Win32::System::Com::CoTaskMemFree(Some(ptr.cast())) };
            }
            Err(e) => println!(
                "GetMixFormat: HRESULT {:#010x} ({e}) — hipótese CONFIRMADA se for E_NOTIMPL 0x80004001",
                hr(&e)
            ),
        }
    }

    /// Abre a captura de verdade e informa qual combinação de formato/flags o
    /// Windows aceitou, quanto cada leitura demora e se chegou áudio.
    ///
    /// Toca um som curto do sistema a partir de OUTRO processo (o PowerShell),
    /// para haver uma fonte conhecida que o modo "excluir este app" tem de
    /// capturar. Você ouve um beep rápido.
    ///
    /// `cargo test --lib open_exclude_self -- --ignored --nocapture`
    #[test]
    #[ignore = "depende do Windows e do áudio desta máquina; toca um som curto"]
    fn open_exclude_self() {
        use std::os::windows::process::CommandExt;
        let mut source = ProcessLoopbackSource::new(LoopbackScope::ExcludeTree(std::process::id()));
        let mut stream = source.open().expect("a captura deveria abrir");

        // Som vindo de fora da árvore do processo de teste.
        let player = std::thread::spawn(|| {
            std::thread::sleep(Duration::from_millis(400));
            let _ = std::process::Command::new("powershell")
                .args([
                    "-NoProfile",
                    "-Command",
                    "[System.Media.SystemSounds]::Exclamation.Play(); Start-Sleep -Milliseconds 1500",
                ])
                .creation_flags(0x0800_0000) // CREATE_NO_WINDOW
                .status();
        });

        let mut out = Vec::new();
        let (mut reads, mut data_reads, mut slowest) = (0u32, 0u32, Duration::ZERO);
        let started = std::time::Instant::now();
        while started.elapsed() < Duration::from_secs(3) {
            let t = std::time::Instant::now();
            let outcome = stream.read(Duration::from_millis(50), &mut out).expect("leitura");
            slowest = slowest.max(t.elapsed());
            reads += 1;
            if outcome == ReadOutcome::Data {
                data_reads += 1;
            }
        }
        let _ = player.join();
        let peak = out.iter().fold(0.0f32, |m, s| m.max(s.abs()));
        println!(
            "leituras={reads} (com dados={data_reads}) mais_lenta={slowest:?} amostras={} pico={peak:.4}",
            out.len()
        );
    }

    /// Como `read` se comporta SEM nada tocando: o loopback em silêncio pode não
    /// sinalizar o evento, e o que importa é nunca passar do `timeout` pedido
    /// (senão o `stop` da sessão demora). Mostra a duração de cada leitura.
    ///
    /// `cargo test --lib silence_read_timing -- --ignored --nocapture`
    #[test]
    #[ignore = "depende do Windows; rode com nada tocando"]
    fn silence_read_timing() {
        let mut source = ProcessLoopbackSource::new(LoopbackScope::ExcludeTree(std::process::id()));
        let mut stream = source.open().expect("a captura deveria abrir");
        let mut durations = Vec::new();
        let mut samples = 0usize;
        for _ in 0..20 {
            let mut out = Vec::new();
            let t = std::time::Instant::now();
            let outcome = stream.read(Duration::from_millis(50), &mut out).expect("leitura");
            samples += out.len();
            durations.push((t.elapsed().as_millis(), outcome));
        }
        println!("amostras={samples}");
        println!("duracoes_ms={:?}", durations.iter().map(|(d, _)| *d).collect::<Vec<_>>());
        let worst = durations.iter().map(|(d, _)| *d).max().unwrap_or(0);
        println!("pior={worst}ms (pedido: 50ms)");
    }

    #[test]
    fn wave_format_describes_what_we_ask_for() {
        // Copia os campos antes de comparar: WAVEFORMATEX é `packed`.
        let f32_fmt = wave_format(SampleFormat::F32);
        let (tag, ch, rate, avg, align, bits) = (
            f32_fmt.wFormatTag,
            f32_fmt.nChannels,
            f32_fmt.nSamplesPerSec,
            f32_fmt.nAvgBytesPerSec,
            f32_fmt.nBlockAlign,
            f32_fmt.wBitsPerSample,
        );
        assert_eq!((tag, ch, rate, bits), (WAVE_FORMAT_IEEE_FLOAT, 2, 48_000, 32));
        assert_eq!(align, 8);
        assert_eq!(avg, 48_000 * 8);

        let s16 = wave_format(SampleFormat::S16);
        let (tag, align, bits) = (s16.wFormatTag, s16.nBlockAlign, s16.wBitsPerSample);
        assert_eq!((tag, align, bits), (WAVE_FORMAT_PCM, 4, 16));
    }

    #[test]
    fn float_with_converter_is_tried_first() {
        assert_eq!(INIT_ATTEMPTS[0], (SampleFormat::F32, FLAGS_CONVERT));
        // Toda tentativa precisa ser loopback + orientada a evento.
        for (_, flags) in INIT_ATTEMPTS {
            assert_ne!(flags & AUDCLNT_STREAMFLAGS_LOOPBACK, 0);
            assert_ne!(flags & AUDCLNT_STREAMFLAGS_EVENTCALLBACK, 0);
        }
    }

    #[test]
    fn stream_open_order_is_a_table_not_a_chain() {
        // Quatro combinações distintas, sem repetir.
        let mut seen = Vec::new();
        for attempt in INIT_ATTEMPTS {
            assert!(!seen.contains(&attempt), "tentativa repetida: {attempt:?}");
            seen.push(attempt);
        }
    }
}
