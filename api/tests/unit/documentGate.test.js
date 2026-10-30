import { expect } from "chai";
import { evaluateDocumentGate } from "../../src/services/documentGate.service";

const daysFromToday = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const doc = (overrides = {}) => ({
  docType: "commercial_invoice",
  label: "Commercial invoice",
  mandatory: true,
  status: "uploaded",
  expiresAt: null,
  ...overrides,
});

describe("Unit: document gate", () => {
  it("passes when every mandatory document is uploaded or verified", () => {
    const result = evaluateDocumentGate([
      doc({ status: "uploaded" }),
      doc({ docType: "packing_list", status: "verified" }),
    ]);
    expect(result).to.deep.equal({ passed: true, missing: [] });
  });

  it("passes an empty checklist", () => {
    expect(evaluateDocumentGate().passed).to.equal(true);
  });

  it("ignores optional documents that are still outstanding", () => {
    const result = evaluateDocumentGate([doc(), doc({ mandatory: false, status: "required" })]);
    expect(result.passed).to.equal(true);
  });

  it("explains why each mandatory document blocks dispatch", () => {
    const result = evaluateDocumentGate([
      doc({ docType: "a", status: "required" }),
      doc({ docType: "b", status: "rejected" }),
      doc({ docType: "c", status: "verified", expiresAt: daysFromToday(-1) }),
    ]);
    expect(result.passed).to.equal(false);
    expect(result.missing.map((m) => [m.docType, m.reason])).to.deep.equal([
      ["a", "Document not uploaded"],
      ["b", "Document was rejected"],
      ["c", "Document has expired"],
    ]);
  });

  it("accepts a document that expires today or later", () => {
    const result = evaluateDocumentGate([
      doc({ expiresAt: daysFromToday(0) }),
      doc({ docType: "x", expiresAt: daysFromToday(30) }),
    ]);
    expect(result.passed).to.equal(true);
  });
});
