import React from "react";
import { type DetailRow, DetailRows } from "./detail-rows";
import { type DateInput, formatDateTime } from "./format-date";
import { Frame } from "./frame";

void React;

export type RequestDevice = {
  browser?: string;
  os?: string;
};

/** Where a sign-in request came from, shown so a stranger's attempt is easy to spot. */
export type RequestContext = {
  email?: string;
  instance?: string;
  requestedAt?: DateInput;
  device?: RequestDevice;
};

/** From `emails.requestDetails` in i18n/en-US.json. */
export type RequestDetailsCopy = {
  title: string;
  account: string;
  instance: string;
  requested: string;
  device: string;
  /** `{{browser}} on {{os}}` */
  browserOn: string;
};

function describeDevice(copy: RequestDetailsCopy, device?: RequestDevice) {
  if (device?.browser && device.os) {
    return copy.browserOn
      .replace("{{browser}}", device.browser)
      .replace("{{os}}", device.os);
  }
  return device?.browser ?? device?.os;
}

export function RequestDetails({
  copy,
  email,
  instance,
  requestedAt,
  device,
}: RequestContext & { copy: RequestDetailsCopy }) {
  const rows: DetailRow[] = [
    { label: copy.account, value: email },
    { label: copy.instance, value: instance },
    {
      label: copy.requested,
      value: requestedAt ? formatDateTime(requestedAt, "en") : undefined,
    },
    { label: copy.device, value: describeDevice(copy, device) },
  ].filter((row) => Boolean(row.value));

  if (rows.length === 0) return null;

  return (
    <Frame title={copy.title} panelPadding="8px 20px">
      <DetailRows rows={rows} />
    </Frame>
  );
}
