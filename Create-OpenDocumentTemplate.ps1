[CmdletBinding()]
param(
    [string]$OutputPath = 'C:\Users\Peter\Documents\documentdemo\documentdemo_AssetsTK\Content\document-template.odt'
)

$ErrorActionPreference = 'Stop'

$resolvedParent = [System.IO.Path]::GetDirectoryName([System.IO.Path]::GetFullPath($OutputPath))
[System.IO.Directory]::CreateDirectory($resolvedParent) | Out-Null

$contentXml = @'
<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
  xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
  office:version="1.3">
  <office:automatic-styles>
    <style:style style:name="Title" style:family="paragraph">
      <style:paragraph-properties fo:margin-bottom="0.20in"/>
      <style:text-properties fo:font-size="20pt" fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="Heading" style:family="paragraph">
      <style:text-properties fo:font-size="12pt" fo:font-weight="bold"/>
    </style:style>
  </office:automatic-styles>
  <office:body>
    <office:text>
      <text:p>%meta%</text:p>
      <text:p text:style-name="Title">%Title%</text:p>
      <table:table table:name="DocumentDetails">
        <table:table-column/>
        <table:table-column/>
        <table:table-row>
          <table:table-cell office:value-type="string"><text:p text:style-name="Heading">Document number</text:p></table:table-cell>
          <table:table-cell office:value-type="string"><text:p>%DocumentNumber%</text:p></table:table-cell>
        </table:table-row>
        <table:table-row>
          <table:table-cell office:value-type="string"><text:p text:style-name="Heading">Created</text:p></table:table-cell>
          <table:table-cell office:value-type="string"><text:p>%CreatedDate%</text:p></table:table-cell>
        </table:table-row>
        <table:table-row>
          <table:table-cell office:value-type="string"><text:p text:style-name="Heading">Customer</text:p></table:table-cell>
          <table:table-cell office:value-type="string"><text:p>%CustomerName%</text:p></table:table-cell>
        </table:table-row>
      </table:table>
      <text:p text:style-name="Heading">Description</text:p>
      <text:p>%Description%</text:p>
    </office:text>
  </office:body>
</office:document-content>
'@

$stylesXml = @'
<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
  office:version="1.3">
  <office:styles>
    <style:default-style style:family="paragraph">
      <style:text-properties fo:font-family="Arial" fo:font-size="10pt"/>
    </style:default-style>
  </office:styles>
</office:document-styles>
'@

$metaXml = @'
<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"
  office:version="1.3">
  <office:meta>
    <meta:generator>Codex MDriven OpenDocument template generator</meta:generator>
  </office:meta>
</office:document-meta>
'@

$settingsXml = @'
<?xml version="1.0" encoding="UTF-8"?>
<office:document-settings
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  office:version="1.3">
  <office:settings/>
</office:document-settings>
'@

$manifestXml = @'
<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest
  xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"
  manifest:version="1.3">
  <manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="settings.xml" manifest:media-type="text/xml"/>
</manifest:manifest>
'@

Add-Type -AssemblyName System.IO.Compression

$fileStream = [System.IO.File]::Open($OutputPath, [System.IO.FileMode]::Create)
try {
    $archive = [System.IO.Compression.ZipArchive]::new(
        $fileStream,
        [System.IO.Compression.ZipArchiveMode]::Create,
        $false
    )
    try {
        function Add-TextEntry {
            param(
                [Parameter(Mandatory = $true)][string]$Name,
                [Parameter(Mandatory = $true)][string]$Value,
                [System.IO.Compression.CompressionLevel]$Compression = [System.IO.Compression.CompressionLevel]::Optimal
            )

            $entry = $archive.CreateEntry($Name, $Compression)
            $stream = $entry.Open()
            try {
                $encoding = [System.Text.UTF8Encoding]::new($false)
                $writer = [System.IO.StreamWriter]::new($stream, $encoding)
                try { $writer.Write($Value) } finally { $writer.Dispose() }
            }
            finally {
                $stream.Dispose()
            }
        }

        Add-TextEntry -Name 'mimetype' -Value 'application/vnd.oasis.opendocument.text' -Compression ([System.IO.Compression.CompressionLevel]::NoCompression)
        Add-TextEntry -Name 'content.xml' -Value $contentXml
        Add-TextEntry -Name 'styles.xml' -Value $stylesXml
        Add-TextEntry -Name 'meta.xml' -Value $metaXml
        Add-TextEntry -Name 'settings.xml' -Value $settingsXml
        Add-TextEntry -Name 'META-INF/manifest.xml' -Value $manifestXml
    }
    finally {
        $archive.Dispose()
    }
}
finally {
    $fileStream.Dispose()
}

Get-Item -LiteralPath $OutputPath | Select-Object FullName, Length, LastWriteTime
