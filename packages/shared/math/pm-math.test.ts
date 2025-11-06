import { describe, it, expect } from "vitest";
import * as M from "./pm-math";

const approx = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol;

describe("Conversions", () => {
  it("logit/prob round-trip", () => {
    const pts = [0.01, 0.1, 0.3, 0.5, 0.7, 0.9, 0.99];
    for (const p of pts) {
      const z = M.probToLogit(p);
      const p2 = M.logitToProb(z);
      expect(approx(p, p2, 1e-10)).toBe(true);
    }
  });

  it("US odds round-trip for typical values", () => {
    const ps = [0.6, 0.4, 0.25, 0.75];
    for (const p of ps) {
      const us = M.probToUSOdds(p);
      const p2 = M.usOddsToProb(us);
      expect(approx(p, p2, 1e-12)).toBe(true);
    }
  });
});

describe("Break-even, EV, Kelly", () => {
  it("break-even probability matches numeric example", () => {
    const c = 0.6, f = 0.02;
    const pbe = M.breakEvenProb(c, f);
    expect(approx(pbe, 0.6048387096774194, 1e-12)).toBe(true);
  });

  it("Kelly is zero at/below break-even and increases with edge", () => {
    const c = 0.6, f = 0.02;
    const pbe = M.breakEvenProb(c, f);
    expect(M.kellyFraction(pbe - 1e-6, c, f)).toBe(0);
    expect(M.kellyFraction(pbe, c, f)).toBe(0);
    const k1 = M.kellyFraction(pbe + 0.05, c, f);
    const k2 = M.kellyFraction(pbe + 0.10, c, f);
    expect(k2).toBeGreaterThan(k1);
  });

  it("Kelly sample values", () => {
    // Reference values (computed externally)
    expect(approx(M.kellyFraction(0.65, 0.6, 0.02), 0.11428571428571442, 1e-12)).toBe(true);
    expect(approx(M.kellyFraction(0.70, 0.6, 0.02), 0.2408163265306122, 1e-12)).toBe(true);
  });
});

describe("LMSR", () => {
  it("price/skew round-trip", () => {
    const b = 50;
    const p = 0.73;
    const s = M.lmsrSkewFromPrice(p, b);
    const p2 = M.lmsrPriceFromSkew(s, b);
    expect(approx(p, p2, 1e-12)).toBe(true);
  });

  it("trade to target price hits target and has positive cost", () => {
    const b = 50; let qy = 10, qn = 10;
    const res = M.lmsrTradeToTargetPrice(qy, qn, b, 0.7);
    expect(Math.abs(res.pNew - 0.7)).toBeLessThan(1e-12);
    expect(res.cost).toBeGreaterThan(0);
  });
});

describe("CPMM (XYK)", () => {
  it("invariant holds when computing target probability state", () => {
    const x=1000, y=1000, pT=0.7;
    const k=x*y;
    const r = M.cpmmTradeToTargetProb(x,y,pT,0);
    expect(approx(r.x1 * r.y1, k, 1e-6)).toBe(true);
    expect(Math.abs(r.pNew - pT)).toBeLessThan(1e-12);
  });

  it("buy then sell yields less NO than paid (no-fee slippage)", () => {
    const x=1000, y=1000; const dx=50;
    const buy = M.cpmmBuyYesCost(x,y,dx,0);
    const sell = M.cpmmSellYesReceiveNo(buy.x1, buy.y1, dx, 0);
    expect(sell.dyToUser).toBeLessThan(buy.dyPaid);
  });

  it("slippage summary is consistent", () => {
    const s = M.cpmmSlippageSummary(1000,1000,100,0.003);
    expect(s.slipPct).toBeGreaterThan(0);
    expect(s.p1).toBeGreaterThan(s.p0);
  });
});

