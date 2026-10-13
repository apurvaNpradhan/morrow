export const darkColors = {
  background: "#141414",
  foreground: "#F5F5F5",
  subtle: "#A3A3A3",
  mutedForeground: "#818181",
  mutedOnFrame: "#8C8C8C",
  frame: "#1B1B1B",
  card: "#181818",
  border: "#222222",
  input: "#272727",
  control: "#1A1A1A",
} as const;

// Dark mode is opt-in per element through these classes. Everything that can
// be a plain hex colour is, so clients that ignore the media query (or invert
// colours themselves, like Gmail and Outlook apps) still render readable mail.
const rules: Array<[string, string]> = [
  [".m-bg", `background-color:${darkColors.background}`],
  [".m-text", `color:${darkColors.foreground}`],
  [".m-subtle", `color:${darkColors.subtle}`],
  [".m-muted", `color:${darkColors.mutedForeground}`],
  [".m-frame .m-muted", `color:${darkColors.mutedOnFrame}`],
  [".m-frame", `background-color:${darkColors.frame}`],
  [
    ".m-panel",
    `background-color:${darkColors.background};border-color:${darkColors.border}`,
  ],
  [
    ".m-card",
    `background-color:${darkColors.card};border-color:${darkColors.border}`,
  ],
  [".m-divider", `border-color:${darkColors.border}`],
  [
    ".m-slot",
    `background-color:${darkColors.control};border-color:${darkColors.input};color:${darkColors.foreground}`,
  ],
  [
    ".m-btn",
    `background-color:${darkColors.foreground};border-color:${darkColors.foreground};color:#262626`,
  ],
  [".m-link", `color:${darkColors.foreground}`],
];

function important(declarations: string) {
  return declarations
    .split(";")
    .map((declaration) => `${declaration}!important`)
    .join(";");
}

const darkRules = rules
  .map(([selector, declarations]) => `${selector}{${important(declarations)}}`)
  .join("");

const outlookRules = rules
  .map(
    ([selector, declarations]) =>
      `[data-ogsc] ${selector},[data-ogsb] ${selector}{${important(declarations)}}`,
  )
  .join("");

const autolinkReset =
  "color:inherit!important;text-decoration:none!important;font-size:inherit!important;font-family:inherit!important;font-weight:inherit!important;line-height:inherit!important";

export const themeCss = [
  ":root{color-scheme:light dark;supported-color-schemes:light dark}",
  `a[x-apple-data-detectors]{${autolinkReset}}`,
  "u + #body a{color:inherit;text-decoration:none;font-size:inherit;font-family:inherit;font-weight:inherit;line-height:inherit}",
  "@media (prefers-color-scheme: dark){",
  darkRules,
  "}",
  outlookRules,
].join("");
