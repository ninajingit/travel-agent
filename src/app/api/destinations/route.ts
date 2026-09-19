import { NextResponse } from "next/server";
import { signedInUser } from "@/lib/auth";
import {
  badRequest,
  optionalText,
  readJsonObject,
  requiredText,
  unauthorized,
} from "@/lib/api";
import {
  createDestination,
  listDestinations,
} from "@/db/queries/destinations";

export async function GET() {
  const user = await signedInUser();
  if (!user) return unauthorized();

  return NextResponse.json(await listDestinations(user.id));
}

export async function POST(request: Request) {
  const user = await signedInUser();
  if (!user) return unauthorized();

  const body = await readJsonObject(request);
  if (!body) return badRequest("Body must be a JSON object.");

  const name = requiredText(body.name, "name");
  if (!name.ok) return badRequest(name.error);
  const country = requiredText(body.country, "country");
  if (!country.ok) return badRequest(country.error);
  const notes = optionalText(body.notes, "notes");
  if (!notes.ok) return badRequest(notes.error);

  const row = await createDestination(user.id, {
    name: name.value,
    country: country.value,
    notes: notes.value,
  });
  return NextResponse.json(row, { status: 201 });
}
