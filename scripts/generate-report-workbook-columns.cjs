const fs = require("node:fs");
const path = require("node:path");
const XLSX = require("xlsx");

const projectRoot = path.resolve(__dirname, "..");
const workbookPath = path.join(
  projectRoot,
  "attached_assets",
  "NIDO_Platform_Modules_and_Report_Columns_1791611819419.xlsx",
);
const outputPath = path.join(projectRoot, "src", "lib", "reportWorkbookColumns.generated.ts");

const workbook = XLSX.readFile(workbookPath);
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {
  header: 1,
  defval: "",
});

const columnsByModule = new Map();
const moduleOrder = [];
for (const [moduleName, rawOrder, rawColumn] of rows.slice(1)) {
  const module = String(moduleName ?? "").trim();
  const column = String(rawColumn ?? "").trim();
  const order = Number(rawOrder);
  if (!module || !column || !Number.isFinite(order)) continue;
  if (!columnsByModule.has(module)) moduleOrder.push(module);
  const columns = columnsByModule.get(module) ?? [];
  columns.push({ order, column });
  columnsByModule.set(module, columns);
}

const orderedColumns = Object.fromEntries(
  [...columnsByModule.entries()].map(([module, columns]) => [
      module,
      columns
        .sort((left, right) => left.order - right.order)
        .map(({ column }) => column),
  ]),
);

const output = [
  "// Generated from the NIDO report-column workbook. Do not edit by hand.\n",
  `export const REPORT_WORKBOOK_MODULE_ORDER: string[] = ${JSON.stringify(moduleOrder)};\n`,
  "export const REPORT_WORKBOOK_COLUMNS: Record<string, string[]> = ",
  `${JSON.stringify(orderedColumns, null, 2)};`,
  "",
].join("");

fs.writeFileSync(outputPath, output);
console.log(`Generated ordered columns for ${Object.keys(orderedColumns).length} report views.`);
