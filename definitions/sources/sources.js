// sources.js — khai báo 7 raw tables (C# AfwLecangsSync ghi vào). Dataform chỉ đọc.
// Dataset theo môi trường lấy từ vars.raw_dataset (dev/prod).

const rawDataset = (dataform.projectConfig.vars && dataform.projectConfig.vars.raw_dataset)
  ? dataform.projectConfig.vars.raw_dataset
  : "afw_lecangs_raw";

const rawTables = [
  "raw_lecangs_inventory",
  "raw_lecangs_inventory_flow",
  "raw_lecangs_outbound_2c",
  "raw_lecangs_outbound_2b",
  "raw_lecangs_inbound",
  "raw_lecangs_invoice_summary",
  "raw_lecangs_invoice_detail",
];

rawTables.forEach(name => {
  declare({
    database: dataform.projectConfig.defaultDatabase,
    schema: rawDataset,
    name,
  });
});
