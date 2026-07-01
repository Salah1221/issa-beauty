import { Resend } from "resend";

const FROM = "ISSA Beauty <orders@send.issabeauty.org>";

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const money = (n) => `$${Number(n).toFixed(2)}`;

function shell(heading, bodyHtml) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#faf7f5;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;">
    <div style="max-width:560px;margin:0 auto;padding:24px;">
      <div style="font-size:22px;font-weight:700;color:#e11d63;letter-spacing:0.5px;">ISSA Beauty</div>
      <h1 style="font-size:18px;margin:16px 0;">${heading}</h1>
      ${bodyHtml}
      <p style="margin-top:24px;font-size:12px;color:#8a8a8a;">ISSA Beauty · Automated message, please don't reply.</p>
    </div>
  </body></html>`;
}

function itemsTable(order) {
  const rows = order.items
    .map(
      (it) =>
        `<tr><td style="padding:6px 0;">${esc(it.name)} × ${it.quantity}</td><td style="padding:6px 0;text-align:right;">${money(it.lineTotal)}</td></tr>`,
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;">
    ${rows}
    <tr><td colspan="2" style="border-top:1px solid #eee;padding-top:8px;"></td></tr>
    <tr><td style="padding:2px 0;color:#666;">Subtotal</td><td style="text-align:right;">${money(order.subtotal)}</td></tr>
    <tr><td style="padding:2px 0;color:#666;">Delivery</td><td style="text-align:right;">${money(order.deliveryFee)}</td></tr>
    <tr><td style="padding:6px 0;font-weight:700;">Total</td><td style="text-align:right;font-weight:700;">${money(order.total)}</td></tr>
  </table>`;
}

function addressBlock(order) {
  const s = order.shipping || {};
  const area = s.area ? `, ${esc(s.area)}` : "";
  const notes = s.notes ? `<br/><span style="color:#666;">Notes: ${esc(s.notes)}</span>` : "";
  return `<p style="font-size:14px;line-height:1.5;">${esc(order.customer.fullName)}<br/>${esc(order.customer.phone)}<br/>${esc(s.address)}${area}, ${esc(s.city)}${notes}</p>`;
}

export function orderConfirmationEmail(order) {
  const firstName = esc(order.customer.fullName.split(" ")[0]);
  const html = shell(
    `Thanks for your order, ${firstName}!`,
    `<p style="font-size:14px;">Your order <strong>${esc(order.orderNumber)}</strong> is confirmed. Payment is <strong>cash on delivery</strong>.</p>
     <h2 style="font-size:14px;margin:20px 0 8px;">Order</h2>${itemsTable(order)}
     <h2 style="font-size:14px;margin:20px 0 8px;">Delivery to</h2>${addressBlock(order)}`,
  );
  return { subject: `Order ${order.orderNumber} confirmed — ISSA Beauty`, html };
}

export function newOrderNotificationEmail(order) {
  const email = order.customer.email ? ` · ${esc(order.customer.email)}` : "";
  const html = shell(
    `New order ${esc(order.orderNumber)}`,
    `<p style="font-size:14px;"><strong>${esc(order.customer.fullName)}</strong> · ${esc(order.customer.phone)}${email}</p>
     ${itemsTable(order)}
     <h2 style="font-size:14px;margin:20px 0 8px;">Deliver to</h2>${addressBlock(order)}
     <p style="font-size:13px;color:#666;">Cash on delivery.</p>`,
  );
  return { subject: `New order ${order.orderNumber} — ${money(order.total)}`, html };
}

export async function sendEmail({ to, subject, html }) {
  // Read the key at call time — dotenv.config() runs after this module is
  // imported, so a module-level read would miss a key set only in .env.
  const apiKey = process.env.RESEND;
  if (!apiKey) {
    console.warn("RESEND not set; skipping email:", subject);
    return;
  }
  await new Resend(apiKey).emails.send({ from: FROM, to, subject, html });
}
