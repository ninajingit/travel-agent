import { NextResponse } from "next/server";
import { signedInUser } from "@/lib/auth";
import {
  badRequest,
  notFound,
  optionalText,
  parseId,
  readJsonObject,
  requiredText,
  unauthorized,
} from "@/lib/api";
import {
  archiveDestination,
  updateDestination,
  type DestinationInput,
} from "@/db/queries/destinations";

type Context = RouteContext<"/api/destinations/[id]">;

export async function PATCH(request: Request, { params }: Context) {
  const user = await signedInUser();
  if (!user) return unauthorized();

  const id = parseId((await params).id);
  if (!id) return notFound();

  const body = await readJsonObject(request);
  if (!body) return badRequest("Body must be a JSON object.");

  // Only fields present in the body change.
  const patch: Partial<DestinationInput> = {};
  if ("name" in body) {
    const name = requiredText(body.name, "name");
    if (!name.ok) return badRequest(name.error);
    patch.name = name.value;
  }
  if ("country" in body) {
    const country = requiredText(body.country, "country");
    if (!country.ok) return badRequest(country.error);
    patch.country = country.value;
  }
  if ("notes" in body) {
    const notes = optionalText(body.notes, "notes");
    if (!notes.ok) return badRequest(notes.error);
    patch.notes = notes.value;
  }
  if (Object.keys(patch).length === 0) {
    return badRequest("Nothing to update.");
  }

  const row = await updateDestination(user.id, id, patch);
  return row ? NextResponse.json(row) : notFound();
}

// DELETE archives. The row stays so trips that reference it keep working.
export async function DELETE(_request: Request, { params }: Context) {
  const user = await signedInUser();
  if (!user) return unauthorized();

  const id = parseId((await params).id);
  if (!id) return notFound();

  const row = await archiveDestination(user.id, id);
  return row ? NextResponse.json(row) : notFound();
}
