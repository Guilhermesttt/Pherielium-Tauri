Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
Function Await-WinRt($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
}

try {
    [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media, ContentType=WindowsRuntime] | Out-Null
    $asyncOp = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()
    $mgr = Await-WinRt $asyncOp ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
    
    $sessions = $mgr.GetSessions()
    $found = $null

    foreach ($session in $sessions) {
        $info = $session.GetPlaybackInfo()
        $propsAsync = $session.TryGetMediaPropertiesAsync()
        $props = Await-WinRt $propsAsync ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
        $title = $props.Title
        
        # Ignorar o próprio Hub Pherielium (músicas/temas internos)
        if ($title -like "*PHERIELIUM*" -or $title -like "*PHELIERIUM*" -or $session.SourceAppId -like "*pherielium*") {
            continue
        }

        if ($title) {
            $status = $info.PlaybackStatus.ToString()
            $playbackType = $props.PlaybackType.ToString()
            $isPlay = ($status -eq "Playing")

            $item = [PSCustomObject]@{
                hasMedia = $true
                title = $title
                artist = $props.Artist
                isPlaying = $isPlay
                playbackType = if ($playbackType -eq "Video") { "video" } else { "music" }
                sourceApp = $session.SourceAppId
            }

            if ($isPlay) {
                $found = $item
                break
            } elseif ($null -eq $found) {
                $found = $item
            }
        }
    }

    if ($found) {
        $found | ConvertTo-Json
    } else {
        [PSCustomObject]@{ hasMedia = $false; isPlaying = $false } | ConvertTo-Json
    }
} catch {
    [PSCustomObject]@{ hasMedia = $false; isPlaying = $false; error = $_.Exception.Message } | ConvertTo-Json
}
