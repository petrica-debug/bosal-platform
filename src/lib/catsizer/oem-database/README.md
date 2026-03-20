# OEM Catalyst Database (JSON)

Bundled data for the AM homologation copilot. **Do not edit JSON by hand.**

## Regenerate from Excel

```bash
python3 scripts/import-oem-catalyst-database.py ~/Downloads/OEM_Catalyst_Database_V4_Bosal.xlsx
```

Requires: `pip install openpyxl`

- **V4** adds the **Source Traceability** sheet (data tiers, confidence, recommended Bosal actions).
- Older workbooks without that sheet still import; `source-traceability.json` will be `[]`.

Outputs under `data/`: `manifest.json`, `ecs-components.json`, `washcoat-chemistry.json`, `am-design-guidance.json`, `pt-pd-substitution.json`, `system-architecture.json`, `source-traceability.json`.
