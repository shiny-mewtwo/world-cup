export const ARCHIVE_MESSAGE = "This site is a read-only archive. Sign-in, editing, and results sync are closed.";

export function archiveResponse() {
  return Response.json({ error: ARCHIVE_MESSAGE }, { status: 410 });
}
