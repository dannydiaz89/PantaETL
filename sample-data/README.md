# Sample data

Small, deliberately messy datasets for exercising each Source end to end. Nothing
here is used by the test suite; it exists so a running deployment has something
real to read.

## Getting a file in

Two ways, and they produce the same result:

- **Upload it.** In the pipeline builder's Source step, choose a file-backed
  Source and use *Upload a file*. The source path fills itself in.
- **Place it.** Copy the file into the import directory
  (`<STORAGE_ROOT>/imports`, by default `/var/lib/pantaetl/storage/imports`) and
  type its relative path. With Docker Compose:

  ```bash
  docker compose cp sample-data/orders.csv worker:/var/lib/pantaetl/storage/imports/orders.csv
  ```

  The source path is then `orders.csv`. Paths are always relative to the import
  directory; absolute paths and `..` are rejected.

## Files

| File | Source | What it is for |
|---|---|---|
| `orders.csv` | CSV | The main tabular flow. 15 rows with the mess a real extract has. |
| `orders-semicolon.csv` | CSV | Semicolon-delimited, for the column separator field. |
| `orders-no-header.csv` | CSV | Starts at the data, for turning off the header option. |
| `product-catalog.json` | JSON | Nested document, for the flatten Transform. |
| `quarterly-budget.xlsx` | Excel workbook | Two worksheets, for the worksheet name field. |
| `postgres-orders.sql` | PostgreSQL | Seeds a `sample` schema to read from and write to. |

## Flows worth trying

### CSV in, CSV out

Source `orders.csv` with the defaults (header on, comma separator). The data is
built to give each Transform something to do:

- Order 1010 appears twice — **deduplicate**.
- `region` is empty on two rows — **fill null**.
- `region` mixes `north`, `North`, and `NORTH` across eight spellings of four
  regions — **normalize string**.
- `order_date` arrives as text — **cast** it to a date.
- `quantity` is empty on one row — **fill null**, or filter the row out.
- `status` is one of shipped, pending, cancelled — **filter**.
- `unit_price` spans two orders of magnitude — **sort**, **limit**.

Export as CSV with a file name like `orders-clean.csv`.

### Separator and header variants

`orders-semicolon.csv` needs the column separator set to `;`. Left at the default
comma, every row parses as a single column, which is a quick way to see what a
misconfigured separator looks like.

`orders-no-header.csv` needs the header option cleared. Leave it on and the first
order silently becomes the column names.

### JSON document to a table

Source `product-catalog.json`, then add the flatten Transform with a record path
of `["catalog", "products"]`. The nested objects become dotted columns
(`pricing.amount`, `supplier.country`).

The `tags` array is where the array mode matters: `json` keeps six rows with tags
as compact JSON text; `explode` expands them to thirteen rows, one per tag. Export
either as CSV or Parquet.

### Excel worksheet

Source `quarterly-budget.xlsx`. Leave the worksheet name empty to read `Q3 Budget`
(10 rows), or set it to `Q4 Budget` (7 rows). Both sheets share a schema, so the
same Transform chain works against either.

### PostgreSQL

Load the seed file, then point a PostgreSQL Source at table `sample.orders`.

To try incremental reads, set the checkpoint column to `updated_at`, run the
pipeline, then insert a row with a later `updated_at` and run it again — only the
new row is read the second time. Checkpoints advance only after a run completes
successfully, so a failed run re-reads the same rows.

`sample.orders_summary` is there as an export target if you want to write a
reduced table back.

## A note on uploads

An uploaded file is held with a 24-hour expiry until a pipeline is saved that
reads it; saving hands the file to that pipeline and it stops being collectable.
An upload you never save into a pipeline is cleaned up automatically. Files copied
into the import directory by hand were never staged and are never collected.
