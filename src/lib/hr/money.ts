export function parseMoneyToPaise(value: string) {
  const match = /^(-?)(\d{1,12})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const rupees = Number(match[2]);
  const paise = Number((match[3] ?? "").padEnd(2, "0"));
  const amount = rupees * 100 + paise;
  if (!Number.isSafeInteger(amount)) return null;
  return match[1] === "-" ? -amount : amount;
}

export function formatMoney(amountPaise: number, currency = "INR") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amountPaise / 100);
}

export function moneyInputValue(amountPaise: number) {
  const sign = amountPaise < 0 ? "-" : "";
  const value = Math.abs(amountPaise);
  return `${sign}${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`;
}
