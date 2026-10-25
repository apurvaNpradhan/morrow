import * as rruleModule from "rrule";

/*
 * Node loads `rrule` as CommonJS, which hides its named exports from `import {
 * RRule }`; bundlers load its ES module, which has no default. Reading the
 * default when there is one works in both.
 */
const rrule: typeof rruleModule =
  (rruleModule as { default?: typeof rruleModule }).default ?? rruleModule;

export const RRule = rrule.RRule;
export type RRule = rruleModule.RRule;
export const Weekday = rrule.Weekday;
export type Weekday = rruleModule.Weekday;
