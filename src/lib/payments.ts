import { api } from "./api";

export type PaymentStatus = "pending" | "approved" | "rejected";

export type Payment = {
  id: string;
  months: number;
  amount_paise: number;
  status: PaymentStatus;
  created_at: string;
  reviewed_at: string | null;
};

export type PaymentInfo = {
  upiId: string;
  upiName: string;
  support: string;
  paisePerMonth: number;
  months: number[];
  payments: Payment[];
};

export const paymentsQuery = {
  queryKey: ["payments"],
  queryFn: () => api<PaymentInfo>("/payments"),
};

/** ₹99 style, from paise. */
export function rupees(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

/**
 * A upi:// deep link. Opening it hands the amount and payee straight to whichever UPI app
 * the phone has (GPay, PhonePe, Paytm, …), so nothing is typed by hand. The payee name is
 * only a label — banks show the name registered against the VPA, not this one.
 */
export function upiLink({
  vpa,
  name,
  paise,
  note,
}: {
  vpa: string;
  name: string;
  paise: number;
  note: string;
}) {
  const params = [
    ["pa", vpa],
    ["pn", name],
    ["am", (paise / 100).toFixed(2)],
    ["cu", "INR"],
    ["tn", note],
  ]
    .map(([k, v]) => `${k}=${encode(v ?? "")}`)
    .join("&");
  return `upi://pay?${params}`;
}

// `@` is legal inside a query value, and UPI apps match the VPA literally — so it is put
// back after encoding rather than left as %40, which many of them do not decode.
const encode = (value: string) => encodeURIComponent(value).replace(/%40/g, "@");

/** Same rule the API enforces, so the form can say no before a round trip. */
export const UPI_VPA = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z]{2,32}$/;
export const UTR = /^[0-9]{9,22}$/;
