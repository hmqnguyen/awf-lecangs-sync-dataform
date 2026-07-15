// sources_external.js — khai báo bảng nguồn NGOÀI Lecangs (chỉ ĐỌC) để dựng mart cross-warehouse.
// Cùng project (defaultDatabase: dev=allforwood-dev / prod=allforwood), khác dataset.
// Tên dataset giữ nguyên giữa 2 môi trường nên hardcode schema là an toàn.

const db = dataform.projectConfig.defaultDatabase;

const externalSources = [
  // Amazon (FBA)
  ["afw_amazon_master",  "master_amazon_inventory"],
  ["afw_amazon_master",  "master_amazon_orders"],
  // Wayfair (Castlegate)
  ["afw_wayfair_master", "master_wayfair_inventory_castlegate"],
  ["afw_wayfair_master", "master_wayfair_order_line"],
  // Walmart (WFS)
  ["afw_walmart_master", "master_walmart_inventory"],
  ["afw_walmart_master", "master_walmart_order_lines"],
  // Airtable crosswalk / product master
  ["afw_airtable",       "sku_crosswalk"],
  ["afw_airtable",       "master_airtable_sku"],
];

externalSources.forEach(([schema, name]) => declare({ database: db, schema, name }));
