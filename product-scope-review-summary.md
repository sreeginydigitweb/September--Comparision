# Product Scope Review — summary (2026-09-29)

Generated from the validated six-account, September sales-qualified population.
**No dashboard, dataset, or PH Priors change was made.**

Review file: `product-scope-review.csv` — 2431 rows, UTF-8 with BOM, opens
straight into Excel.

## Counts

| Suggested Classification | Rows | Share |
|---|---|---|
| LIKELY LAMP SHADE | 514 | 21.1% |
| LIKELY WALL PLUG | 63 | 2.6% |
| AMBIGUOUS | 981 | 40.4% |
| LIKELY EXCLUDE | 873 | 35.9% |
| **Total** | **2431** | |

## How to use it

Fill two columns and send the file back:

- **Final Decision** — `INCLUDE` or `EXCLUDE`
- **Final Product Type** — `Lamp Shade` or `Wall Plug` (leave blank when excluding)

`Review Note` is free text for anything worth recording.

Rows are ordered **LIKELY LAMP SHADE → LIKELY WALL PLUG → AMBIGUOUS → LIKELY EXCLUDE**, and
within each group by TY Sales then LY Sales descending — so the commercially important
products come first and the tail can be skimmed.

> **Suggested Classification is a review aid, not a decision.** Nothing will be published
> from it — only from **Final Decision**.

### How the suggestion was derived

- **Primary signals** — the item's own title, parent SKU and SKU. Single-valued and
  trustworthy.
- **Secondary** — the multi-channel `product_type` string, consulted **only** when the
  primary signals say nothing. The previous run proved it unreliable: 84% of items carry
  conflicting types, up to 28 on one item, and a flagged LED transformer carried
  `Lampshades & Lightshades` among its types.
- **Exclusion beats a positive match** on the same item, so a transformer that also looks
  shade-ish is never quietly suggested as a lamp shade.

`Candidate Product Types` is kept in full in the CSV so a reviewer can see exactly what the
data claims — including where it contradicts itself.

### One question that would speed this up

Only 63 rows carry a plug/socket signal, and the term is genuinely ambiguous in this
catalogue — it may mean plug-in wall lights, electrical wall sockets, or screw fixings
(`Wall Plugs & Fixings` exists on just 4 listings estate-wide). **Please confirm which
meaning is intended**; that single answer may resolve a number of AMBIGUOUS rows by itself.

## Examples — LIKELY LAMP SHADE

| Account | eBay ID | SKU ID | Title / family | Candidate Types | LY | TY |
|---|---|---|---|---|---|---|
| Sunsone | 317754733734 | LS2CA600BF+LDMC35E1446PK | — | Chandelier Light / Crystal Lightng / Kronleuchter / Lamp s | 0.00 | 599.78 |
| Ledsone | 164525233292 | LSCY210BG+RPR44WH | Vintage Retro Pendant Lampshade | Ceiling Pendant Lights / Easy Fit / Easy_Fit_Lamp_Shades / | 1,210.05 | 525.20 |
| Sunsone | 317778069689 | LSCA2L300SG | — | Ceiling Lights / Chandelier Light / LIGHT_FIXTURE / Lamp s | 0.00 | 399.98 |
| Ledsone | 166971786198 | LSSS300BM+RPR44WH | Barn slotted colour lampshade | Easy_Fit_Lamp_Shades / LAMPSHADE / LIGHT_FIXTURE / Lamp Sh | 0.00 | 316.68 |
| Sunsone | 318680643474 | LSCA2L300SG | — | Ceiling Lights / Chandelier Light / Kronleuchter / LIGHT_F | 0.00 | 304.18 |
| Electricalsone | 267423256407 | LSCA400BF | Crystal Chandelier | Chandelier Light / Crystal Lightng / Kronleuchter / LIGHT_ | 0.00 | 299.36 |
| Sunsone | 317496848100 | LSCA280SG | — | Ceiling Lights / Ceiling Pendant Lights / Chandelier Light | 0.00 | 295.89 |
| Ledsone | 165849956709 | LSCA1000BF | 1m crystal panendant light | Chandelier Light / Crystal Lightng / Kronleuchter / LIGHT_ | 0.00 | 289.00 |
| Ledsone | 163502414049 | LSFT220BB+RPR44WH | Modern Light | Easy_Fit_Lamp_Shades / HOME / LAMPSHADE / LIGHT_FIXTURE /  | 29.37 | 275.40 |
| Electricalsone | 267214427494 | WCDSBM | Lampshade Pendant | LAMPSHADE / Lamp shades, holders & accessories / Lampensch | 0.00 | 273.17 |

## Examples — LIKELY WALL PLUG

| Account | eBay ID | SKU ID | Title / family | Candidate Types | LY | TY |
|---|---|---|---|---|---|---|
| Ledsone | 164046479684 | PSDS4BMRBL | Dimmer Plug in light | Ceiling Pendant Lights / LIGHT_BULB_SOCKET / Light Shades  | 239.31 | 261.80 |
| Sunsone | 317609587060 | PSDS2BMB14BM | Plug in pendant Light Black and White | LIGHT_BULB_SOCKET / Lamps / Light Bulbs / Pendant_Holder / | 0.00 | 192.80 |
| Ledsone | 163844479887 | PSDS2BMB14BM | Plug in pendant Light Black and White | LIGHT_BULB_SOCKET / Lamps / Light Bulbs / Pendant_Holder / | 447.93 | 163.84 |
| Electricalsone | 266132039859 | PSDS2BMB14BM | Socket Holder | LIGHT_BULB_SOCKET / Lamps / Light Bulbs / Pendant_Holder / | 0.00 | 119.86 |
| Ledsone | 164389514552 | PSDS2BMRBL | Dimmer Plug in light | Ceiling Pendant Lights / LIGHT_BULB_SOCKET / Plug In Penda | 89.84 | 115.99 |
| Electricalsone | 267660184323 | PSDS4RBL | — | Lamp Holders / Plug In Pendant / Plugin_Lighting | 0.00 | 110.61 |
| Ledsone | 164279909548 | PSDS2RBL | 2m/4m Plug in pendant light | LIGHT_BULB_SOCKET / LIGHT_FIXTURE / Lamp Holders / POWER_C | 47.42 | 108.12 |
| Ledsone | 166269554733 | PSHNOA2BRBM | OF/OFF Switch Plug in Light Cord | Ceiling Lights / Ceiling Pendant Lights / LIGHT_BULB_SOCKE | 250.86 | 104.11 |
| Ledsone | 165029827381 | ENC2815 | Plug in Wall light Black | — | 0.00 | 80.76 |
| Electricalsone | 266095194768 | PSDS2RBL+LHSHE27BL | Pendant Lamp | Plugin_Lighting | 8.99 | 79.83 |

## Examples — AMBIGUOUS

| Account | eBay ID | SKU ID | Title / family | Candidate Types | LY | TY |
|---|---|---|---|---|---|---|
| Huttenlampen | 394976085481 | COI9ASBM5PK | — | Andere | 0.00 | 556.98 |
| ledsone de | 406565104060 | LDMG125E278 | — | Bulb / Bulb_B22_Base B / Bulb_E27_Base / Dekorative Glühbi | 0.00 | 550.38 |
| Electricalsone | 266508050517 | COI9BBM-IDE | — | Andere | 211.06 | 467.45 |
| Ledsone | 162823715743 | ENC10313 | Industrial Wall Light Vintage Adjustable Wall Sconce | Home, Furniture & DIY:Lighting:Wall Lights | 83.44 | 415.71 |
| Ledsone | 168569593779 | CRSF120YB+WSUSHE27YB+SPAL6 | — | LIGHT_FIXTURE / Wall Light / Wandleuchten | 0.00 | 407.88 |
| Sunsone | 317380877663 | PLHIBC | — | LIGHT_FIXTURE / Pendant Light / Pendant lighting / Pipe_La | 0.00 | 367.12 |
| Sunsone | 313970190831 | WCFRBM | New Rope Pendant Light | Ceiling Lights & Chandeliers / Ceiling Pendant Lights / LI | 0.00 | 356.22 |
| Sunsone | 313978289239 | CRFF500BM+LHNDE27BM2PK+LHN | 3 Way Ceiling Pendant Light Vintage Retro Cluster | Ceiling Light / Ceiling lights / Deckenleuchten / LIGHT_FI | 0.00 | 342.90 |
| Ledsone | 167826149061 | CRFF100BM+LHNSE27BM | sku not assigneds | Ceiling Light Fixtures / Ceiling Lights / Ceiling Lights & | 0.00 | 313.14 |
| Ledsone | 163481444917 | LHSHE27BA | sku not assigneds | Ceiling Pendant Lights / Downlight Lampholders / LAMP / LI | 114.54 | 300.56 |

## Examples — LIKELY EXCLUDE

| Account | eBay ID | SKU ID | Title / family | Candidate Types | LY | TY |
|---|---|---|---|---|---|---|
| Huttenlampen | 394444713965 | 12IP20100-IDE | AC- DC 5V 12V 24V LED Netzteil Trafo | Constant Voltage Transformer / DC 12V Transformer / DC 5V  | 3,521.27 | 2,118.98 |
| Electricalsone | 267073162939 | LDMA60B224CW | LED E27 Bulbs | B22 Base Bulb B / B22 Base LED Bulb / B22_Base_Bulb / Bulb | 1,875.00 | 1,331.57 |
| Ledsone | 163585361443 | 12IP6710 | IP67 LED Driver Power supply Transformer | Cables & LED drivers / Constant Voltage Transformer / DC 5 | 1,297.13 | 1,190.08 |
| Ledsone | 164261730528 | 12BO100 | BLUE AND ORANGE LED DRIVER | Cables & LED drivers / Constant Voltage Transformer / LED_ | 434.77 | 837.23 |
| Electricalsone | 267121715682 | 12IP6710 | sku not assigneds | Cables & LED drivers / Constant Voltage Transformer / DC 1 | 1,147.05 | 800.70 |
| Ledsone | 162799417330 | 12IP20100 | Metal LED Driver IP20 | Cables & LED drivers / Constant Voltage Transformer / DC 1 | 317.90 | 757.17 |
| Ledsone | 162553025729 | CRSFDUMMYSKU | Vintage LED Light Bulbs | B22_Base_Bulb / Bulb / Bulb_B22_Base B / Bulb_E14_Base / B | 21.78 | 712.43 |
| Electricalsone | 266742973079 | CL3TAG | — | Cable / Cable Ties / Cables / Cables & LED drivers / ELECT | 162.00 | 640.86 |
| Electricalsone | 267068731282 | 12IP6710 | sku not assigneds | Cables & LED drivers / Constant Voltage Transformer / DC 5 | 946.49 | 562.49 |
| Huttenlampen | 394458014499 | 12IP6710-IDE | DC12V/24V LED Trafo Transformator | Cables & LED drivers / Constant Voltage Transformer / Dc 1 | 944.02 | 560.49 |

## Next step

Return the completed CSV. The final population is then
**Final Decision = INCLUDE ∩ six approved accounts ∩ September sales** — no classification
guesswork left. `sql/f-combined-sales-driven.sql` takes the approved eBay IDs directly, so
the rebuild, validation, standalone regeneration and PH row 1947 push are a single short run.
