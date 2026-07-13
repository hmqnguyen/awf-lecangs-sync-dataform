# AFW — Nguyên tắc chung cho mọi pipeline mới

Áp dụng cho tất cả pipeline: Lecangs, Amazon, Wayfair/Castlegate, Walmart, Shopify, Etsy…

---

## Nguyên tắc 1 — Staging không bao giờ lọc theo trạng thái thay đổi được

> **Trạng thái là CỘT DỮ LIỆU, không phải BỘ LỌC.**

- Staging chỉ làm: parse + ép kiểu + **dedup**. Không có `WHERE status = ...`, `WHERE valid = 1`, `WHERE deleted IS NULL`.
- Mọi quy tắc kinh doanh (bỏ đơn huỷ, chỉ tính xuất bán, loại điều chỉnh…) → **fact/mart**.

**Vì sao:** trạng thái đổi theo thời gian. Nếu staging lọc, bản ghi bị lọc ra sẽ **biến mất khỏi mọi tầng dưới** — và khi trạng thái đổi ngược lại, ta không có cách nào phát hiện. Lọc ở fact/mart thì luôn còn đường quay lại vì dữ liệu vẫn nằm ở staging/master.

**Cách nhận biết vi phạm:** bất kỳ `WHERE` nào trong staging tham chiếu cột có thể đổi giá trị (status, valid, deleted, type…).

**Được phép trong staging:** cột dẫn xuất (`asn_kind`, `business_type_label`) — vì đó là *gắn nhãn*, không phải *loại bỏ*.

---

## Nguyên tắc 2 — Cửa sổ ingest phải phủ trọn vòng đời thay đổi của thực thể

> Nếu report lọc theo **ngày sự kiện** mà trạng thái đổi **sau đó** → phải dùng report **by-last-update**, hoặc **nới cửa sổ**.

Phân loại watermark của mỗi domain:

| Loại | Ví dụ | Xử lý |
|---|---|---|
| **By-last-update** (`updateTime`) | inventory_flow, inbound, outbound_2c | ✅ An toàn — mọi thay đổi tự lọt cửa sổ. Watermark tiến tới là đủ. |
| **By-event-date** (`createTime`, `billingDate`) | outbound_2b, warehouse_rent, bill | ⚠️ **Nguy hiểm** — watermark chỉ tiến tới ⇒ thực thể đổi sau đó **không bao giờ được kéo lại**. Bắt buộc **ReprocessDays**: mỗi run luôn thò lại N ngày. |
| **Snapshot** (không watermark) | inventory | ✅ N/A — mỗi run chụp lại toàn bộ. |

**Chọn N (ReprocessDays):** N ≥ độ dài vòng đời thay đổi của thực thể.
- Đơn hàng: từ tạo → giao xong → **chi phí settle xong** (thường lâu nhất).
- Chi phí/hoá đơn: cho tới khi hết khả năng bị điều chỉnh hồi tố (reversal/adjustment).

**Dấu hiệu thực thể bị sửa hồi tố:** payload có `updateTime`, `historyId`, `returnExpense`/`deductExpense`, sheet reversal (反冲) → chắc chắn cần ReprocessDays.

**Chi phí của việc nới cửa sổ = 0 rủi ro dữ liệu:** raw là append-only, staging dedup theo khóa → kéo lại bản trùng là vô hại. Chỉ tốn thêm API call. **Luôn nghiêng về nới rộng.**

---

## Áp dụng cho pipeline Lecangs (đã audit)

**Nguyên tắc 1 — PASS.** Không staging nào lọc theo trạng thái. Filter nghiệp vụ (`qty_delta < 0`, `business_type_label IN ('2C_order','2B_order')`) nằm đúng ở fact/mart.

**Nguyên tắc 2 — đã phát hiện & sửa 2 vi phạm:**

| Domain | Vấn đề | Fix |
|---|---|---|
| **outbound_2b** | API **không có** filter `updateTime` — chỉ lọc `createTime`. Vòng đời 2B: tạo đơn → đổi status → `expenseList` **tích luỹ thêm phí** (gồm `2B_Storage` 转运仓租). Watermark 72h theo createTime ⇒ đơn cũ đổi status/thêm phí **không bao giờ** được kéo lại ⇒ master giữ status cũ vĩnh viễn, `fact_logistics_cost` **thiếu phí 2B phát sinh sau**. | `ReprocessDays: 120` (env `LECANGS_2B_REPROCESS_DAYS`) |
| **warehouse_rent** | Lọc theo `billingDate`. Phí bị **điều chỉnh hồi tố** (dấu hiệu: `dailyExpenseHistoryId`, `returnExpense`, `deductExpense`). | `ReprocessDays: 45` (env `LECANGS_RENT_REPROCESS_DAYS`) |

**Cài đặt:** thêm `int? ReprocessDays` vào `LecangsDomain`; `RawSyncRunner` hạ `since` xuống sàn `runStart - ReprocessDays` bất kể watermark. `WarehouseRentSyncRunner` áp tương tự.

**Còn theo dõi:** `bill` (lọc `createTime`) — hoá đơn là snapshot file nên tạm chấp nhận, nhưng payload có sheet 反冲 (reversal) ⇒ nếu thấy hoá đơn bị sửa, đặt `ReprocessDays` cho bill.

---

## Checklist khi mở pipeline MỚI

1. [ ] Liệt kê mọi endpoint → watermark field là **updateTime** hay **event date**?
2. [ ] Với mỗi event-date endpoint: vòng đời thay đổi dài bao lâu? → đặt `ReprocessDays` ≥ vòng đời.
3. [ ] Staging: chỉ parse + dedup. **Không** `WHERE` theo trạng thái.
4. [ ] Fact/mart: đặt toàn bộ quy tắc kinh doanh ở đây.
5. [ ] Master incremental: lọc theo **ngày nạp** (`_loaded_at`), **không** theo ngày nghiệp vụ (backfill-safe).
