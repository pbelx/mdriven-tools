[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][ValidateRange(1,65535)][int]$Port,
    [string]$ClassName = '',
    [string]$HostName = 'localhost',
    [string]$Route = '/mcp/api',
    [ValidateRange(1,120)][int]$TimeoutSec = 15,
    [string]$OutputPath = ''
)
$ErrorActionPreference = 'Stop'
if (-not $Route.StartsWith('/')) { $Route = '/' + $Route }
$uri = "http://${HostName}:${Port}${Route}"
$headers = @{ Accept = 'application/json, text/event-stream'; 'mcp-protocol-version' = '2024-11-05' }
$script:requestId = 0
function Send-Mcp([string]$Method, [hashtable]$Params, [switch]$Notification) {
    $payload = @{ jsonrpc = '2.0'; method = $Method; params = $Params }
    if (-not $Notification) { $script:requestId++; $payload.id = $script:requestId }
    $bytes = [Text.Encoding]::UTF8.GetBytes(($payload | ConvertTo-Json -Depth 20 -Compress))
    $response = Invoke-WebRequest -Uri $uri -Method Post -Headers $headers -ContentType 'application/json; charset=utf-8' -Body $bytes -UseBasicParsing -TimeoutSec $TimeoutSec
    if ($response.Headers['Mcp-Session-Id']) { $headers['Mcp-Session-Id'] = $response.Headers['Mcp-Session-Id'] }
    if ([string]::IsNullOrWhiteSpace($response.Content)) { return $null }
    $body = $response.Content.Trim()
    if ($body.StartsWith('event:') -or $body.StartsWith('data:')) {
        $messages = @($body -split '\r?\n\r?\n' | ForEach-Object {
            $data = (($_ -split '\r?\n') | Where-Object { $_.StartsWith('data:') } | ForEach-Object { $_.Substring(5).TrimStart() }) -join "`n"
            if ($data) { $data | ConvertFrom-Json }
        })
        $decoded = $messages | Where-Object { $null -ne $_.id } | Select-Object -Last 1
    } else { $decoded = $body | ConvertFrom-Json }
    if ($decoded.error) { throw "MCP $Method failed: $($decoded.error.message)" }
    return $decoded.result
}
try {
    $init = Send-Mcp 'initialize' @{ protocolVersion='2024-11-05'; capabilities=@{}; clientInfo=@{name='mdriven-state-machine-inspector';version='1.0'} }
    if (-not $init.serverInfo -or -not $init.protocolVersion) { throw 'Invalid initialize result.' }
    $headers['mcp-protocol-version'] = $init.protocolVersion
    $null = Send-Mcp 'notifications/initialized' @{} -Notification
    $listing = Send-Mcp 'tools/list' @{}
    $tool = 'MCPTool_MDrivenDesigner_EvaluateOCLOnMetaModel'
    if ($tool -notin @($listing.tools.name)) { throw 'Read-only metamodel evaluator not available.' }
    $queries = [ordered]@{ capabilities='MCPServerInfo.GetOverViewOfCapabilitiesForOCL' }
    # OCL single-quoted literals escape apostrophes by doubling them.
    $literal = $ClassName.Replace("'", "''")
    if ($ClassName -match '[\r\n]') { throw 'ClassName must be a single-line model name.' }
    $selectors = [ordered]@{
        machines=@('StateMachine','x.Owner.Name'); regions=@('Region','x.StateMachine.Owner.Name');
        states=@('State','x.Container.StateMachine.Owner.Name'); pseudoStates=@('PseudoState','x.Container.StateMachine.Owner.Name');
        transitions=@('Transition','x.Region.StateMachine.Owner.Name'); methods=@('Method','x.Owner.Name');
        stateAttributes=@('Attribute','x.Owner.Name')
    }
    foreach ($key in $selectors.Keys) {
        $type, $owner = $selectors[$key]
        $query = "$type.allinstances"
        if ($ClassName) {
            $regions = "Class.allinstances->select(c|c.Name='$literal').StateMachine.AllRegionsInStateMachine"
            if ($key -eq 'regions') { $query += "->select(x|$regions->includes(x))" }
            elseif ($key -in @('states','pseudoStates')) { $query += "->select(x|$regions->includes(x.Container))" }
            elseif ($key -eq 'transitions') { $query += "->select(x|$regions->includes(x.Region))" }
            else { $query += "->select(x|$owner='$literal')" }
        }
        if ($key -eq 'stateAttributes') { $query += '->select(x|x.StateAttributeFor->notEmpty)' }
        $queries[$key] = $query
    }
    $triggerQuery = 'MethodTrigger.allinstances'
    if ($ClassName) { $triggerQuery += "->select(x|x.Method.Owner.Name='$literal')" }
    $queries['methodTriggers'] = $triggerQuery
    $queries['activities'] = 'Activity.allinstances'
    $queries['uiActions'] = "AbstractAction.allinstances->collect(a|a.Name.concat(' | ').concat(a.ExecuteExpression).concat(' | enabled: ').concat(a.EnableExpression))"
    $results = [ordered]@{}
    $failed = $false
    foreach ($key in $queries.Keys) {
        $result = Send-Mcp 'tools/call' @{ name=$tool; arguments=@{OCLOrActionExpression=$queries[$key];ContextForSelfNameOrId='';ReturnObjectAggregatesNotJustTheObject=$false} }
        if ($result.isError) { throw "Evaluator tool error for ${key}: $($result.content | ConvertTo-Json -Compress)" }
        $text = @($result.content | Where-Object { $_.type -eq 'text' })
        if ($text.Count -ne 1) { throw "Unexpected evaluator content for $key" }
        $outer = $text[0].text | ConvertFrom-Json
        if (-not $outer.RawJson) { throw "Missing evaluator RawJson for $key" }
        $inner = $outer.RawJson | ConvertFrom-Json
        if ($inner.expressionError) { $failed = $true }
        $results[$key] = @{expression=$queries[$key];data=$inner}
    }
    $report = [ordered]@{endpoint=$uri;server=$init.serverInfo;protocol=$init.protocolVersion;classFilter=$ClassName;readOnly=$true;expressionFailures=$failed;inspections=$results}
    $json = $report | ConvertTo-Json -Depth 30
    if ($OutputPath) { $json | Set-Content -LiteralPath $OutputPath -Encoding UTF8 }
    Write-Output $json
    if ($failed) { exit 2 }
} catch { Write-Error $_; exit 1 }
