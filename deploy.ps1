<#
.SYNOPSIS
Deploys the SVES application to Google Cloud Run from source.

.DESCRIPTION
This script authenticates into Google Cloud if necessary, then uses the 'gcloud run deploy' command to build the Docker container using Cloud Build and deploy it sequentially to Cloud Run.
You will be prompted for your PROJECT_ID and your GEMINI_API_KEY if they aren't pre-configured.

.NOTES
To use this script:
1. Ensure you have installed the Google Cloud CLI (gcloud): https://cloud.google.com/sdk/docs/install
2. Run this script in PowerShell: .\deploy.ps1
#>

$ErrorActionPreference = "Stop"

# 1. Verify gcloud installation
if (-not (Get-Command "gcloud" -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Google Cloud CLI (gcloud) is not installed or not in your PATH." -ForegroundColor Red
    Write-Host "Please download and install it from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

# 2. Get Project Configuration
$projectId = Read-Host "Enter your Google Cloud Project ID"
if ([string]::IsNullOrWhiteSpace($projectId)) {
    Write-Host "Project ID cannot be empty. Exiting." -ForegroundColor Red
    exit 1
}

$region = Read-Host "Enter Google Cloud Region (Default: us-central1)"
if ([string]::IsNullOrWhiteSpace($region)) {
    $region = "us-central1"
}

# 3. Secure API Key Setup
Write-Host "`nTo operate Gemini AI capabilities, provide an active API Key." -ForegroundColor Cyan
Write-Host "You can get one at: https://aistudio.google.com" -ForegroundColor DarkGray
$apiKey = Read-Host "Enter your GEMINI_API_KEY (Text will not be masked in terminal)"

if ([string]::IsNullOrWhiteSpace($apiKey)) {
    Write-Host "Warning: Deploying without GEMINI_API_KEY. AI features will fail." -ForegroundColor Yellow
    $envVars = ""
} else {
    $envVars = "--set-env-vars=GEMINI_API_KEY=$apiKey"
}

# 4. Auth check & deploy
Write-Host "`nSetting project to $projectId..." -ForegroundColor Green
gcloud config set project $projectId

Write-Host "`nDeploying SVES to Cloud Run..." -ForegroundColor Green
Write-Host "This will build the Dockerfile in Cloud Build and deploy the resulting image." -ForegroundColor DarkGray

$deployCommand = "gcloud run deploy sves-portal --source . --region $region --allow-unauthenticated $envVars"

Invoke-Expression $deployCommand

Write-Host "`nDeployment completed successfully!" -ForegroundColor Green
