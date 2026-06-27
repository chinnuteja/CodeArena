$ErrorActionPreference = 'Continue'
$aws = "C:\Program Files\Amazon\AWSCLIV2\aws.exe"
$account = "615299739853"
$region = "ap-south-1"
$ecrBase = "$account.dkr.ecr.$region.amazonaws.com"

Write-Host "Logging into AWS ECR..."
& $aws ecr get-login-password --region $region | docker login --username AWS --password-stdin $ecrBase

Write-Host "Creating Repositories..."
$repos = @("oj-api", "oj-worker", "oj-nginx")
foreach ($repo in $repos) {
    # Ignore error if it already exists
    & $aws ecr create-repository --repository-name $repo --region $region 2>$null
}

Write-Host "Building oj-api image..."
docker build -t $ecrBase/oj-api:latest -f Dockerfile .

Write-Host "Building oj-worker image..."
docker build -t $ecrBase/oj-worker:latest -f Dockerfile.worker .

Write-Host "Building oj-nginx image..."
docker build -t $ecrBase/oj-nginx:latest -f Dockerfile.nginx .

Write-Host "Pushing oj-api image..."
docker push $ecrBase/oj-api:latest

Write-Host "Pushing oj-worker image..."
docker push $ecrBase/oj-worker:latest

Write-Host "Pushing oj-nginx image..."
docker push $ecrBase/oj-nginx:latest

Write-Host "PHASE 1 COMPLETE!"
