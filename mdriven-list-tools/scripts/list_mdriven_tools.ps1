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

function Invoke-OclCapabilityProbe {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,

        [Parameter(Mandatory = $true)]
        [string]$Expression,

        [int]$PreviewLength = 600
    )

    try {
        $response = Invoke-McpRequest -Payload @{
            jsonrpc = '2.0'
            id = 100 + $script:probeIndex
            method = 'tools/call'
            params = @{
                name = 'MCPTool_MDrivenDesigner_EvaluateOCLOnMetaModel'
                arguments = @{
                    OCLOrActionExpression = $Expression
                    ContextForSelfNameOrId = ''
                    ReturnObjectAggregatesNotJustTheObject = $false
                }
            }
        }
        $script:probeIndex++

        $data = $response.Content | ConvertFrom-Json
        if ($data.error) {
            return [pscustomobject]@{
                name = $Name
                expression = $Expression
                available = $false
                error = $data.error.message
                preview = $null
            }
        }

        $textItem = @($data.result.content | Where-Object { $_.text } | Select-Object -First 1)
        if (-not $textItem) {
            return [pscustomobject]@{
                name = $Name
                expression = $Expression
                available = $false
                error = 'The evaluator returned no text content.'
                preview = $null
            }
        }

        $outer = $textItem[0].text | ConvertFrom-Json
        $inner = if ($outer.RawJson) { $outer.RawJson | ConvertFrom-Json } else { $outer }
        if ($inner.expressionError) {
            return [pscustomobject]@{
                name = $Name
                expression = $Expression
                available = $false
                error = $inner.expressionError
                preview = $null
            }
        }

        $resultText = [string]$inner.resultfromexpression
        $preview = if ($resultText.Length -gt $PreviewLength) {
            $resultText.Substring(0, $PreviewLength) + '...'
        } else {
            $resultText
        }

        return [pscustomobject]@{
            name = $Name
            expression = $Expression
            available = $true
            error = $null
            preview = $preview
        }
    }
    catch {
        return [pscustomobject]@{
            name = $Name
            expression = $Expression
            available = $false
            error = $_.Exception.Message
            preview = $null
        }
    }
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

    $tools = @($toolData.result.tools)
    $oclToolAvailable = @($tools | Where-Object { $_.name -eq 'MCPTool_MDrivenDesigner_EvaluateOCLOnMetaModel' }).Count -gt 0
    $script:probeIndex = 0
    $capabilityProbes = @()

    if ($oclToolAvailable) {
        $capabilityProbes += Invoke-OclCapabilityProbe -Name 'OCL overview' -Expression 'MCPServerInfo.GetOverViewOfCapabilitiesForOCL'
        $capabilityProbes += Invoke-OclCapabilityProbe -Name 'Action Language overview' -Expression 'MCPServerInfo.GetOverViewOfCapabilitiesForActionLanguage'
        $capabilityProbes += Invoke-OclCapabilityProbe -Name 'MetaModelMetaInfo' -Expression "MCPServerInfo.MetaModelMetaInfo('Attribute')"
        $capabilityProbes += Invoke-OclCapabilityProbe -Name 'MDriven Wiki search' -Expression "MCPServerInfo.WikiSearch('OpenDocument report')"
        $capabilityProbes += Invoke-OclCapabilityProbe -Name 'MDriven Wiki fetch' -Expression "MCPServerInfo.WikiFetch('Documentation:MCP')"
    }

    [pscustomobject]@{
        endpoint = $uri
        serverName = $initializeData.result.serverInfo.name
        serverVersion = $initializeData.result.serverInfo.version
        protocolVersion = $initializeData.result.protocolVersion
        tools = $tools
        embeddedCapabilities = $capabilityProbes
    } | ConvertTo-Json -Depth 20
}
catch {
    Write-Error "Unable to inspect MDriven MCP capabilities at ${uri}: $($_.Exception.Message)"
    exit 1
}

