# AfwLecangsDataform

Transform BigQuery cho Lecangs — mirror `AfwDataform` (Amazon). **4 lớp**:

```
Raw (C# AfwLecangsSync ghi)  →  Staging  →  Master & Fact
```

C# chỉ ghi `raw_payload`; repo này đọc raw và dựng staging → master → fact.

## Layers
- **sources** (`definitions/sources/sources.js`): declare 7 raw tables (`raw_lecangs_*`).
- **staging** (7): parse `raw_payload` (JSON) + dedupe. Outbound giữ mảng nested (`package_list` / `goods_list` / `expense_list`) dạng JSON để fact UNNEST.
- **master** (2): `master_lecangs_inventory` (snapshot theo ngày, giữ lịch sử), `master_lecangs_inventory_flow` (ledger bất biến, tích luỹ theo `serial_no`).
- **fact** (2): `fact_order_line` (2C+2B), `fact_logistics_cost` (fulfillment 2C/2B + storage).

## Môi trường (dev/prod)
Tách theo project qua `environments/{dev,prod}.json` + `workflow_settings.yaml` (vars datasets). `master_dataset = fact_dataset`.

| | dev | prod |
|---|---|---|
| project | allforwood-dev | allforwood |
| raw / staging / fact | `afw_lecangs_*_dev` | `afw_lecangs_*` |

Chạy: `dataform run --environment dev` (hoặc prod). Dataform đọc raw do C# ghi; trigger sau khi sync xong hoặc theo lịch riêng.

## Lưu ý
- `raw_payload` là kiểu **JSON** → dùng `JSON_VALUE` (scalar) và `JSON_QUERY_ARRAY` (mảng). Snapshot_date = `DATE(_ingested_at)`.
- **Phí fulfillment (2C/2B) ở mức order/package, chưa phân bổ về SKU** — Cost Allocation Engine là bước sau; `fact_logistics_cost.goods_code` chỉ có ở dòng storage.
- **Timezone**: thời gian Lecangs theo giờ Bắc Kinh; các cột thời gian giữ nguyên như API trả — cân nhắc chuẩn hoá nếu cần so khớp múi giờ.
- Chưa có COGS / SKU master mapping (goods_code = AFW SKU) — JOIN sang bảng mapping khi có.

## Bill
- `stg_lecangs_bill_summary` (getByPage list) + `stg_lecangs_bill_detail` (mọi sheet, giữ `sheet_name` + `values` JSON).
- Model typed per-sheet (运费 freight, 系统费用 system_fee, ...) là bước sau: `SELECT ... FROM stg_lecangs_bill_detail WHERE sheet_name = '运费'`, trích cột bằng `JSON_VALUE(values_json, "$['类型']")`.

## Mart (afw_lecangs_mart[_dev])
- **mart_sku_logistics_daily** — chi phí logistics per-SKU/ngày/kho, tách cột fulfillment/storage/inbound. Nền so Lecangs vs Castlegate vs FBA.
- **mart_warehouse_cost_daily** — tổng chi phí theo ngày × kho (so cấp kho).
- **mart_sku_pnl_daily** — SKELETON P&L (DISABLED). Bật khi có nguồn doanh thu/COGS/phí sàn từ pipeline khác.
