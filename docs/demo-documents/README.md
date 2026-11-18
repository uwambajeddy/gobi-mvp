# Demo documents

These are the files to upload in step 3 of the [demo walkthrough](../../README.md#demo-walkthrough). There is one folder per demo account. Every file is a fictional specimen marked "Demo specimen" and is not a valid document. Gobi stores uploaded files without reading them, so these files only make the demo look real.

## Create the shipment so the papers match

| Field | Value |
|---|---|
| Title | Cooking oil import: Dar es Salaam to Kigali |
| Origin | Dar es Salaam Port, Tanzania |
| Destination | Kigali Distribution warehouse, Gikondo, Kigali |
| Cross-border | On |
| Package 1 | Palm olein cooking oil, 20 L jerrycans: 19 kg × 1000 |
| Package 2 | Vegetable shortening, 10 kg cartons: 11 kg × 400 |

That's 23,400 kg in total, which fits truck RAE 001 T (30,000 kg). The papers name RAE 001 T and David Niyonzima, so dispatch that pair.

## Who uploads what

| Sign in as | Folder | File | Checklist row |
|---|---|---|---|
| shipper@gobi.rw | `shipper/` | `1-commercial-invoice.pdf` | Commercial Invoice |
| | | `2-packing-list.pdf` | Packing List |
| | | `3-certificate-of-origin-illegible-scan.png`, then `3-certificate-of-origin.pdf` | Certificate of Origin |
| | | `4-insurance-certificate.pdf` | Insurance Certificate |
| agent@gobi.rw | `agent/` | `1-import-declaration-form-idf.pdf` | Import Declaration Form (IDF) |
| | | `2-duty-payment-receipt.pdf` | Duty Payment Receipt |
| | | `3-release-order.pdf` | Release Order |
| coordinator@gobi.rw | `coordinator/` | `1-comesa-yellow-card.pdf` | COMESA Yellow Card |
| | | `2-c2-transit-manifest.pdf` | C2 / Transit Manifest |
| driver@gobi.rw, after delivery | `driver/` | `1-signed-delivery-note.pdf` | Signed Delivery Note (optional) |

**Certificate of origin.** Upload the blurry PNG first. That way the coordinator's rejection ("Scan is illegible") makes sense. Then upload the clear PDF.

**Proof of delivery.** When the driver captures POD, enter the receiver as Jean Bosco Nshimiyimana, the name that signed the delivery note.

**Customs duty payment.** The agent records a payment of 26,686,610 RWF, the total on the duty receipt. Attach `2-duty-payment-receipt.pdf` as the proof.
