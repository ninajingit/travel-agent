import { NextResponse } from "next/server";

// Small helpers so every route handler answers errors the same way.

export function unauthorized() {
  return NextResponse.json({ error: "Sign in required." }, { status: 401 });
}

export function notFound() {
  return NextResponse.json({ error: "Not found." }, { status: 404 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

// Reads a JSON object body. Anything else (bad JSON, arrays, null) is a 400.
export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    if (typeof body === "object" && body !== null && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

type TextResult<T> = { ok: true; value: T } | { ok: false; error: string };

// A required text field: must be a non-empty string under the length cap.
export function requiredText(
  value: unknown,
  field: string,
  max = 120,
): TextResult<string> {
  if (typeof value !== "string" || value.trim() === "") {
    return { ok: false, error: `${field} is required.` };
  }
  if (value.trim().length > max) {
    return { ok: false, error: `${field} must be ${max} characters or fewer.` };
  }
  return { ok: true, value: value.trim() };
}

// An optional text field: absent, null, or empty clears it; otherwise same rules.
export function optionalText(
  value: unknown,
  field: string,
  max = 2000,
): TextResult<string | null> {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: null };
  }
  return requiredText(value, field, max);
}

export function parseId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}
