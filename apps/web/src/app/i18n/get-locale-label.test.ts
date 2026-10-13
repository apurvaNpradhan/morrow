import { type AppLocale, supportedLocales } from "@morrow/i18n";
import { describe, expect, it } from "vite-plus/test";
import { getLocaleLabel } from "./get-locale-label";

const label = (locale: string) => getLocaleLabel(locale as AppLocale);

describe("getLocaleLabel", () => {
  it("labels the only supported locale", () => {
    expect(supportedLocales).toEqual(["en-US"]);
    expect(label("en-US")).toBe("English");
  });

  it("gives every supported locale a unique label", () => {
    const labels = supportedLocales.map(label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
