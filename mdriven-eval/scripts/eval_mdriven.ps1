[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateRange(1, 65535)]
    [int]$Port,

    [Parameter(Mandatory = $true)]
    [string]$Expression,

    [string]$Context = '',

    [switch]$ActionLanguage,

    [switch]$ReturnAggregates,

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
                name = 'antigravity-mdriven-client'
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

    $toolName = if ($ActionLanguage) {
        'MCPTool_MDrivenDesigner_EvaluateActionLanguageOnMetaModel'
    } else {
        'MCPTool_MDrivenDesigner_EvaluateOCLOnMetaModel'
    }

    $toolArgs = @{
        OCLOrActionExpression = $Expression
        ContextForSelfNameOrId = $Context
        ReturnObjectAggregatesNotJustTheObject = [bool]$ReturnAggregates
    }

    $callResponse = Invoke-McpRequest -Payload @{
        jsonrpc = '2.0'
        id = 2
        method = 'tools/call'
        params = @{
            name = $toolName
            arguments = $toolArgs
        }
    }

    $callData = $callResponse.Content | ConvertFrom-Json
    if ($callData.error) {
        throw "MCP tools/call failed: $($callData.error.message)"
    }

    $result = $callData.result
    if ($result.content) {
        foreach ($item in $result.content) {
            if ($item.text) {
                Write-Output $item.text
            } else {
                $item | ConvertTo-Json -Depth 10
            }
        }
    } else {
        $result | ConvertTo-Json -Depth 10
    }
}
catch {
    Write-Error "Unable to evaluate on MDriven MCP at ${uri}: $($_.Exception.Message)"
    exit 1
}

