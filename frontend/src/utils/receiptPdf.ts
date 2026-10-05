import { jsPDF } from "jspdf";
import type { Sale } from "../types/domain";

/**
 * Generates and downloads a receipt as a PDF (80mm-wide thermal-receipt style).
 * Pure client-side via jsPDF — no backend involved.
 *
 * Note: the peso sign (₱) is not in jsPDF's built-in WinAnsi font encoding,
 * so amounts are prefixed with "PhP" instead to avoid rendering as garbage.
 */

const PAGE_W = 80; // mm — standard thermal receipt width
const MARGIN = 6; // mm
const LINE_H = 4.2; // mm per text line

export function downloadReceiptPdf(sale: Sale): void {
  const x0 = MARGIN;
  const x1 = PAGE_W - MARGIN;

  // Rough page-height estimate; generous buffer so nothing clips.
  const notesLines = sale.notes
    ? Math.ceil(sale.notes.length / 38)
    : 0;
  const height =
    58 + sale.items.length * LINE_H * 1.4 + notesLines * LINE_H + 16;

  const doc = new jsPDF({ unit: "mm", format: [PAGE_W, height] });
  let y = 12;

  const divider = () => {
    doc.text("-".repeat(34), PAGE_W / 2, y, { align: "center" });
    y += LINE_H * 0.7;
  };

  const kv = (label: string, value: string) => {
    doc.text(label, x0, y);
    doc.text(value, x1, y, { align: "right" });
    y += LINE_H;
  };

  doc.setFont("courier", "bold");
  doc.setFontSize(12);
  doc.text("RBC BAKERY HQ", PAGE_W / 2, y, { align: "center" });
  y += LINE_H;

  doc.setFontSize(9);
  doc.setFont("courier", "normal");
  doc.text(sale.type === "Pre-Order" ? "PRE-ORDER RECEIPT" : "SALE RECEIPT", PAGE_W / 2, y, {
    align: "center",
  });
  y += LINE_H;
  doc.text(sale.id, PAGE_W / 2, y, { align: "center" });
  y += LINE_H;

  divider();

  kv("Customer", sale.customerName || "-");
  if (sale.customerContact) kv("Contact", sale.customerContact);
  kv("Payment", sale.paymentMethod);
  if (sale.type === "Pre-Order" && sale.deliveryDate) kv("Delivery", sale.deliveryDate);
  kv("Date", sale.createdAt ? new Date(sale.createdAt).toLocaleString() : "Date unavailable");

  divider();

  sale.items.forEach((item) => {
    const nameLines = doc.splitTextToSize(item.name, x1 - x0 - 14);
    doc.text(`${item.qty} ${item.unit} @ PhP${item.price.toFixed(2)} ${nameLines[0]}`.trim(), x0, y);
    doc.text(`PhP${item.lineTotal.toFixed(2)}`, x1, y, {
      align: "right",
    });
    y += LINE_H;
    for (let i = 1; i < nameLines.length; i++) {
      doc.text(nameLines[i], x0 + 6, y);
      y += LINE_H;
    }
  });

  divider();

  kv("Subtotal", `PhP${sale.subtotal.toFixed(2)}`);
  if (sale.discount > 0) kv("Discount", `-PhP${sale.discount.toFixed(2)}`);
  kv(
    sale.taxRate === null ? "Tax" : `Tax (${sale.taxRate}%)`,
    sale.tax === null ? "Unavailable" : `PhP${sale.tax.toFixed(2)}`
  );
  doc.setFont("courier", "bold");
  doc.setFontSize(11);
  kv("TOTAL", `PhP${sale.total.toFixed(2)}`);
  doc.setFont("courier", "normal");
  doc.setFontSize(9);

  if (sale.notes) {
    y += 1;
    doc.text("Notes", x0, y);
    y += LINE_H * 0.8;
    doc
      .splitTextToSize(sale.notes, x1 - x0)
      .forEach((line: string) => {
        doc.text(line, x0, y);
        y += LINE_H;
      });
  }

  y += LINE_H;
  divider();
  doc.text("Thank you for your purchase!", PAGE_W / 2, y, { align: "center" });

  doc.save(`receipt-${sale.id}.pdf`);
}
