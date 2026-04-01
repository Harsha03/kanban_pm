$ErrorActionPreference = "Continue"

$containerName = "pm-mvp"

docker stop $containerName | Out-Null
docker rm $containerName | Out-Null

Write-Output "Stopped and removed $containerName"
