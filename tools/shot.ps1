# Captura de páginas con Edge headless para la revisión visual.
# Uso: powershell -File tools/shot.ps1 -Url http://localhost:4321/brand/index.html -Out C:\tmp\shots [-Light]
param([string]$Url, [string]$Out, [switch]$Light)
$E = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
New-Item -ItemType Directory -Force $Out | Out-Null
$scheme = if ($Light) { "light" } else { "dark" }
foreach ($w in @(1440, 820)) {
  $args = @("--headless=new", "--disable-gpu", "--hide-scrollbars", "--user-data-dir=$Out\prof-$scheme",
    "--force-dark-mode=$([int](-not $Light))", "--blink-settings=preferredColorScheme=$([int][bool]$Light)",
    "--virtual-time-budget=5000", "--window-size=$w,5400", "--screenshot=$Out\$scheme-$w.png", $Url)
  Start-Process -FilePath $E -ArgumentList $args -Wait -NoNewWindow
}
