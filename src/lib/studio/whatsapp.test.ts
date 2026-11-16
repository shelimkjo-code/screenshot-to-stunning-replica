import { describe, expect, it } from "vitest";
import { normalizeWaNumber } from "./whatsapp";

describe("normalizeWaNumber", () => {
  it("adds 88 to a local Bangladeshi number", () => expect(normalizeWaNumber("01712-345678")).toBe("8801712345678"));
  it("keeps an international number", () => expect(normalizeWaNumber("+8801712345678")).toBe("8801712345678"));
});
