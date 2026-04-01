$ErrorActionPreference = "Stop"

$imageName = "pm-mvp:local"
$containerName = "pm-mvp"

docker build -t $imageName .
docker rm -f $containerName | Out-Null
docker run -d `
  --name $containerName `
  --env-file .env `
  -p 8000:8000 `
  $imageName | Out-Null

for ($i = 0; $i -lt 30; $i++) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:8000/api/health"
    if ($response.StatusCode -eq 200) {
      Write-Output "App is running at http://127.0.0.1:8000"
      exit 0
    }
  }
  catch {
    Start-Sleep -Seconds 1
  }
}

Write-Error "Container started, but app did not become healthy in time."
exit 1
