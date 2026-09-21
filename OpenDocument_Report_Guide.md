# Creating Documents with MDriven OpenDocument Reports

Source material:

- [Microsoft Office and OpenDocument as a Report Generator](https://wiki.mdriven.net/Training%3AMicrosoft_office_and_OpenDocument_as_a_Report_generator)
- [OpenDocument documentation](https://wiki.mdriven.net/Documentation%3AOpenDocument)

## 1. Choose the document format

MDriven generates documents by merging ViewModel data into an OpenDocument template.

- Use `.odt` for Word-style text documents.
- Use `.ods` for Excel-style spreadsheets.
- HTML templates are also supported when the template is well-formed HTML.

## 2. Create the template

Create a new ODT or ODS document in Microsoft Office, LibreOffice, or another OpenDocument-compatible editor.

For the first test, insert this tag near the beginning of the document:

```text
%meta%
```

The tag is case-sensitive and should be the first text in its element. Do not place spaces between `meta` and the percent signs. When the report is generated, MDriven replaces `%meta%` with a list of the tags available from the report ViewModel.

## 3. Store the template

### Temporary local template

For prototyping, save the file somewhere the running application can read, for example:

```text
C:\temp\document-template.odt
```

The corresponding ViewModel expression is:

```ocl
'C:\temp\document-template.odt'
```

### Deployable AssetsTK template

Beside the model file, create an AssetsTK directory named after the model:

```text
<ModelFileName>_AssetsTK/
└── Content/
    └── document-template.odt
```

In a local Turnkey application, the template is normally available as:

```text
http://localhost:8182/content/document-template.odt
```

MDriven can also retrieve a template from a remote URL or from a modeled BLOB attribute using `TemplateBlob`.

## 4. Create the report ViewModel

Create a ViewModel rooted on the class whose object will supply the report data. A descriptive name such as `OpenDocumentReportTemplate` is useful.

Turn off **Use placing hints** for the ViewModel.

Add the following specially named root columns:

| Column | Purpose |
| --- | --- |
| `TemplateUrl` | URL or local filesystem path of the ODT/ODS template |
| `TemplateBlob` | Optional alternative containing a Base64-encoded template BLOB |
| `TemplateIsHtml` | Optional Boolean identifying an HTML template |
| `ReportFileName` | Suggested filename for the generated document |
| `ReportDirectoryName` | Optional directory information for the document service |

Add ordinary ViewModel columns for every scalar value used in the report. Add nested ViewModel classes for collections that should become repeated table rows.

Example expressions:

```ocl
-- TemplateUrl
'http://localhost:8182/content/document-template.odt'

-- ReportFileName
'GeneratedDocument.odt'
```

## 5. Generate the metadata document

Create a class action on the report root class and call:

```ocl
self.opendocumentreportshow(
  DocumentGenerator.ViewModels.OpenDocumentReportTemplate
)
```

Run the action once while `%meta%` is in the template. The generated document shows the exact tags exposed by the ViewModel.

If the output should be stored or processed instead of immediately opened, use:

```ocl
ResultAsBlob := self.opendocumentreportasblob(
  DocumentGenerator.ViewModels.OpenDocumentReportTemplate
)
```

`ResultAsBlob` must be an appropriate modeled BLOB target.

### Start the report from the main menu

A class action has a current object and can therefore use `self`. A Global Action has no current object, so it should navigate to a user-facing ViewModel and provide that ViewModel's root object explicitly.

The current project has a separate `DocumentGeneratorPage` for user input. The `ShowDocumentGenerator` Global Action is configured as follows:

```text
BringUpViewModel: DocumentGeneratorPage
ExecuteExpression: <empty>
ViewModelRootObjectExpression:
  if DocumentGenerator.allinstances->isEmpty then
    DocumentGenerator.Create
  else
    DocumentGenerator.allinstances->first
  endif
```

The root-object expression creates the one report-controller object when none exists and otherwise reuses the existing object. After saving and refreshing singleton metadata, it can be shortened to:

```ocl
DocumentGenerator.oclSingleton
```

`DocumentGeneratorPage` contains the editable input columns and a `GenerateDocument` action button. That button invokes the class action in the rooted page, where `self` correctly represents the current `DocumentGenerator`. `OpenDocumentReportTemplate` remains a non-UI report definition and is not opened directly.

## 6. Insert scalar tags

Replace `%meta%` with the fields required by the document. A ViewModel column named `CustomerName` is inserted using:

```text
%CustomerName%
```

Keep each complete tag in one consistently formatted text run. In Word, pasting the tag as plain text helps prevent hidden formatting from splitting it internally. Line breaks inside tags also prevent recognition.

## 7. Insert repeating table rows

Create a table row representing one item from a nested ViewModel collection. Put the row-builder tag at the beginning of the row, followed by the child fields. For a nested ViewModel column named `DocumentLines`:

```text
%%+DocumentLines%%
```

Other cells in that row can contain child-column tags such as:

```text
%Description%
%Quantity_float%
%UnitPrice_float%
```

MDriven duplicates the template row for each child item.

## 8. Use qualified tags when needed

A qualified tag selects an item from a nested collection using a child-column value:

```text
%Class2[Name=Hello1]Name%
```

This is useful for name/value collections or cases where the document needs a particular member rather than every member.

## 9. Insert images

Place a placeholder image in the ODT template. In the image's **Alt Text** property, enter the tag for the ViewModel column that supplies the image BLOB. During generation, MDriven replaces the placeholder and preserves the source image's aspect ratio.

## 10. Preserve numeric types in spreadsheets

ODS cells are text by default when populated from ordinary ViewModel tags. Use numeric suffixes on ViewModel column names when the result must behave as a spreadsheet number:

- End a numeric column name with `_float`.
- End a percentage column name with `_percentage`; its value must contain a parseable number followed by `%`.

Verify formulas, number formats, and sorting in the generated spreadsheet.

## 11. Test and deploy

Before deployment, verify:

1. The template URL or BLOB is reachable by the application.
2. `%meta%` produces the expected tag list.
3. Scalar fields are replaced without leftover tags.
4. Nested collections create the correct number of table rows.
5. Empty collections and optional values produce acceptable output.
6. Images are replaced and scaled correctly.
7. ODS numeric and percentage cells have the intended types.
8. The AssetsTK content is included with the deployed model.

If PDF is required, generate the OpenDocument file first and use the documented LibreOffice conversion workflow as a separate step.

## Implemented model structure for the current project

The active `documentdemo` model now contains the following proof-of-concept structure:

- Scalar attributes: `Title`, `DocumentNumber`, `CreatedDate`, `CustomerName`, and `Description`.
- A report ViewModel named `OpenDocumentReportTemplate` rooted on `DocumentGenerator`.
- ViewModel columns for the five scalar attributes plus `TemplateUrl` and `ReportFileName`.
- A class action named `GenerateDocument` that invokes `opendocumentreportshow`.
- An `Eco.IsSingleton=True` tagged value on `DocumentGenerator`.
- A user-facing `DocumentGeneratorPage` ViewModel with the five editable fields and a linked `GenerateDocument` action button.
- A Global Action named `ShowDocumentGenerator`, presented as **Create document**, which opens `DocumentGeneratorPage` with a valid root object.
- An initial template at `documentdemo_AssetsTK/Content/document-template.odt` containing `%meta%` and the five scalar tags.

For local prototyping, the current `TemplateUrl` expression points directly to the verified file instead of assuming that a Turnkey content server is listening on port 8182:

```ocl
'C:/Users/Peter/Documents/documentdemo/documentdemo_AssetsTK/Content/document-template.odt'
```

Change this back to a deployed `/content/document-template.odt` URL only when the AssetsTK content is being served by the target Turnkey application.

### ASP.NET Core static-file note

The local Turnkey Core build used by this project mirrors `document-template.odt` into its live `Content` folder, but its static-file MIME map does not serve the `.odt` extension and returns HTTP 404. The same file is therefore also stored as:

```text
documentdemo_AssetsTK/Content/document-template.zip
```

The `.zip` alias contains identical OpenDocument bytes and is reachable locally at:

```text
http://localhost:8183/Content/document-template.zip
```

The report currently uses the direct local `.odt` path, so it is not affected by the web server's extension filter. If an HTTP template URL is required in this Turnkey build, use the `.zip` alias while keeping `ReportFileName` set to an `.odt` filename.

Repeating line items should be added only after the scalar proof of concept generates correctly.
