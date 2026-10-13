import { describe, expect, it } from "vite-plus/test";
import { getInvitationEmailSubject } from "./get-invitation-email-subject";

describe("getInvitationEmailSubject", () => {
  it.each([
    ["en-US", "Product"],
    ["fr-FR", "Équipe produit"],
    ["de-DE", "Produkt"],
    ["pt-BR", "Equipe produto"],
    ["ja-JP", "プロダクト"],
    ["zh-TW", "產品團隊"],
    ["es-ES", "Producto"],
    [null, "Product"],
  ] as const)(
    "uses English copy for stored locale %s",
    (locale, workspaceName) => {
      expect(getInvitationEmailSubject(locale, "Alice", workspaceName)).toBe(
        `Alice invited you to join ${workspaceName} on Morrow`,
      );
    },
  );

  it("does not interpret placeholders in supplied names", () => {
    expect(
      getInvitationEmailSubject(null, "{{workspaceName}}", "Product"),
    ).toBe("{{workspaceName}} invited you to join Product on Morrow");
  });
});
