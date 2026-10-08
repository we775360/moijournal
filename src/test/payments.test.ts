import { describe, expect, it } from "vitest";
import { rupees, upiLink, UPI_VPA, UTR } from "@/lib/payments";

const VPA = "8108096229@fam";

describe("the UPI payment link", () => {
  const link = upiLink({
    vpa: VPA,
    name: "MoiJournal",
    paise: 9900,
    note: "MoiJournal Premium x1",
  });

  it("is a UPI deep link to the MoiJournal handle", () => {
    expect(link.startsWith("upi://pay?")).toBe(true);
    expect(link).toContain(`pa=${VPA}`);
  });

  it("keeps the @ in the VPA literal, because UPI apps do not decode %40", () => {
    expect(link).not.toContain("%40");
    expect(link).toContain("pa=8108096229@fam");
  });

  it("prefills the amount in rupees, not paise", () => {
    expect(link).toContain("am=99.00");
    expect(link).toContain("cu=INR");
    expect(link).not.toContain("am=9900");
  });

  it("escapes the note so spaces survive the trip", () => {
    expect(link).toContain("tn=MoiJournal%20Premium%20x1");
  });

  it("scales the amount with the number of months", () => {
    expect(upiLink({ vpa: VPA, name: "MoiJournal", paise: 9900 * 6, note: "x6" })).toContain(
      "am=594.00",
    );
  });
});

describe("rupees", () => {
  it("shows rupees from paise", () => {
    expect(rupees(9900)).toBe("₹99");
    expect(rupees(9900 * 12)).toBe("₹1,188");
  });
});

describe("UPI ID and UTR checks", () => {
  it("accepts a normal VPA", () => {
    expect(UPI_VPA.test(VPA)).toBe(true);
    expect(UPI_VPA.test("guneet.singh_1@okhdfcbank")).toBe(true);
  });

  it("rejects things that are not a VPA", () => {
    for (const bad of ["", "fam", "@fam", "user@", "user name@fam", "user@f"]) {
      expect(UPI_VPA.test(bad)).toBe(false);
    }
  });

  it("accepts a 12 digit UTR and rejects junk", () => {
    expect(UTR.test("412345678901")).toBe(true);
    expect(UTR.test("123456789")).toBe(true);
    for (const bad of ["", "abc", "1234", "4123456789012345678901234"]) {
      expect(UTR.test(bad)).toBe(false);
    }
  });
});
