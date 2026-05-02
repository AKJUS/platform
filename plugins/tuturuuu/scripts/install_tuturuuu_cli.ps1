if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
  powershell -c "irm bun.sh/install.ps1 | iex"
}

bun i -g tuturuuu
ttr help
