[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateRange(1, 65535)]
    [int]$Port,

    [string]$HostName = 'localhost',

    [string]$Route = '/mcp/api'
)

$ErrorActionPreference = 'Stop'

if (-not $Route.StartsWith('/')) {
    $Route = '/' + $Route
}

$uri = "http://${HostName}:${Port}${Route}"
$headers = @{
    Accept = 'application/json, text/event-stream'
    'mcp-protocol-version' = '2024-11-05'
}

function Invoke-McpRequest {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Payload
    )

    $body = $Payload | ConvertTo-Json -Depth 12 -Compress
    Invoke-WebRequest -Uri $uri -Method Post -Headers $headers -ContentType 'application/json' -Body $body -UseBasicParsing
}

try {
    $initialize = Invoke-McpRequest -Payload @{
        jsonrpc = '2.0'
        id = 1
        method = 'initialize'
        params = @{
            protocolVersion = '2024-11-05'
            capabilities = @{}
            clientInfo = @{
                name = 'antigravity-mdriven-tool-discovery'
                version = '1.0'
            }
        }
    }

    $initializeData = $initialize.Content | ConvertFrom-Json
    if ($initializeData.error) {
        throw "MCP initialize failed: $($initializeData.error.message)"
    }

    $sessionId = $initialize.Headers['Mcp-Session-Id']
    if ($sessionId) {
        $headers['Mcp-Session-Id'] = $sessionId
    }

    $null = Invoke-McpRequest -Payload @{
        jsonrpc = '2.0'
        method = 'notifications/initialized'
        params = @{}
    }

    $toolResponse = Invoke-McpRequest -Payload @{
        jsonrpc = '2.0'
        id = 2
        method = 'tools/list'
        params = @{}
    }

    $toolData = $toolResponse.Content | ConvertFrom-Json
    if ($toolData.error) {
        throw "MCP tools/list failed: $($toolData.error.message)"
    }

    [pscustomobject]@{
        endpoint = $uri
        serverName = $initializeData.result.serverInfo.name
        serverVersion = $initializeData.result.serverInfo.version
        protocolVersion = $initializeData.result.protocolVersion
        tools = @($toolData.result.tools)
    } | ConvertTo-Json -Depth 20
}
catch {
    Write-Error "Unable to list MDriven MCP tools at ${uri}: $($_.Exception.Message)"
    exit 1
}

