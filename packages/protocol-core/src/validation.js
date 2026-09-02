// SPDX-License-Identifier: Apache-2.0

import { ProtocolError } from "./errors.js";

const opaqueIdPattern = /^[A-Za-z0-9_-]{8,128}$/;

export function requireOpaqueId(value, fieldName) {
  if (typeof value !== "string" || !opaqueIdPattern.test(value)) {
    throw new ProtocolError(
      "INVALID_COMMAND",
      `${fieldName} must be an opaque identifier between 8 and 128 characters`,
    );
  }
  return value;
}

export function requireNonNegativeInteger(value, fieldName) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ProtocolError(
      "INVALID_COMMAND",
      `${fieldName} must be a non-negative safe integer`,
    );
  }
  return value;
}

export function requirePositiveInteger(value, fieldName) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new ProtocolError(
      "INVALID_COMMAND",
      `${fieldName} must be a positive safe integer`,
    );
  }
  return value;
}

export function requireBoolean(value, fieldName) {
  if (typeof value !== "boolean") {
    throw new ProtocolError("INVALID_COMMAND", `${fieldName} must be boolean`);
  }
  return value;
}

export function requireDisplayName(value, fieldName) {
  if (typeof value !== "string") {
    throw new ProtocolError("INVALID_COMMAND", `${fieldName} must be a string`);
  }
  const displayName = value.trim();
  const length = [...displayName].length;
  if (
    length < 1 ||
    length > 40 ||
    /[\u0000-\u001F\u007F]/u.test(displayName)
  ) {
    throw new ProtocolError(
      "INVALID_COMMAND",
      `${fieldName} must contain 1 to 40 visible characters`,
    );
  }
  return displayName;
}
