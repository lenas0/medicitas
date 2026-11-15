# Carga .env.deploy y prepara la base MySQL administrada.
# Uso: powershell -ExecutionPolicy Bypass -File scripts/setup-cloud-db.ps1

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot '.env.deploy'

if (-not (Test-Path $envFile)) {
  throw "No se encontro .env.deploy. Copia .env.deploy.example y completa las credenciales."
}

Get-Content $envFile | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith('#')) { return }
  $separator = $line.IndexOf('=')
  if ($separator -lt 1) { return }
  $name = $line.Substring(0, $separator).Trim()
  $value = $line.Substring($separator + 1).Trim()
  Set-Item -Path "Env:$name" -Value $value
}

if (-not $env:DB_HOST -or -not $env:DB_PASSWORD -or -not $env:DB_NAME) {
  throw 'Completa DB_HOST, DB_PASSWORD y DB_NAME en .env.deploy antes de continuar.'
}

Push-Location $projectRoot
try {
  Write-Host "Base de datos: $env:DB_NAME en $env:DB_HOST" -ForegroundColor Cyan
  node scripts/initDb.js --confirm-database $env:DB_NAME
  if ($LASTEXITCODE -ne 0) { throw 'La inicializacion del esquema fallo.' }

  node scripts/createAdmin.js
  if ($LASTEXITCODE -ne 0) { throw 'La creacion del administrador fallo (puede que ya exista).' }
} finally {
  Pop-Location
}
