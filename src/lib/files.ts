/** Saves text as a file through the browser's normal download flow. */
export function downloadTextFile(fileName: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 10_000);
}

/** Reads a file as UTF-8 text. FileReader works in browsers without `Blob.text()` (Safari < 14). */
export function readFileText(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('The file couldn’t be read.'));
    };
    reader.readAsText(file);
  });
}
