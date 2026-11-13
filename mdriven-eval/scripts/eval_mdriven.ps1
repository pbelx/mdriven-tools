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

    [string]$Route = '/mcp/api',

    [switch]$RawResponse
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
    if ($result.isError) { throw 'MCP evaluator tool failed.' }
    $textItem = @($result.content | Where-Object { $_.text } | Select-Object -First 1)
    if (-not $textItem) { throw 'Missing evaluator text response.' }
    $outer = $textItem[0].text | ConvertFrom-Json
    $inner = if ($null -ne $outer.RawJson) { $outer.RawJson | ConvertFrom-Json } else { $outer }
    if (-not $inner.PSObject.Properties['resultfromexpression'] -and -not $inner.expressionError) { throw 'Invalid evaluator response envelope.' }
    $errors = @($inner.modelwideErrors | Where-Object { $null -ne $_ })
    $report = [ordered]@{ ok=(-not [bool]$inner.expressionError); result=$inner.resultfromexpression; errors=$errors; modelErrorCount=$errors.Count }
    if ($inner.expressionError) { $report['expressionError'] = $inner.expressionError }
    $created = @($inner.createdobjects | Where-Object { $null -ne $_ })
    if ($created.Count) { $report['createdObjects'] = $created }
    if ($RawResponse) { $report['expression'] = $Expression; $report['rawInner'] = $inner }
    $report | ConvertTo-Json -Depth 100 -Compress
    if ($inner.expressionError) { throw "Expression error: $($inner.expressionError)" }
}
catch {
    Write-Error "Unable to evaluate on MDriven MCP at ${uri}: $($_.Exception.Message)"
    exit 1
}

