# Sound only. No window or keyboard APIs. Input is a synthesized PCM WAV in base64.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$reactionAudio = $null
$reactionPlayer = $null
try {
    $reactionBytes = [Convert]::FromBase64String([Console]::In.ReadToEnd())
    $reactionAudio = [System.IO.MemoryStream]::new($reactionBytes, $false)
    $reactionPlayer = [System.Media.SoundPlayer]::new($reactionAudio)
    $reactionPlayer.Load()
    [Console]::Out.WriteLine('READY')
    [Console]::Out.Flush()
    $reactionPlayer.PlaySync()
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
} finally {
    if ($null -ne $reactionPlayer) { $reactionPlayer.Dispose() }
    if ($null -ne $reactionAudio) { $reactionAudio.Dispose() }
}
