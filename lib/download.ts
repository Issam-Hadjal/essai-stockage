// Saving a text as a file, in the browser: the export buttons hand it a JSON text and a
// name, and it downloads it. The event handlers call it, never a render.

// The day in the browser's calendar, for the file name: never toISOString, which gives
// the UTC day.
export function localDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function download(text: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  // In the document while it is clicked: some browsers ignore a detached link.
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked a little later: some browsers start the download after the click returns.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
