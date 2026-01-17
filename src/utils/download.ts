export function downloadStringAsFile(data: string, filename: string) {
  let a = document.createElement('a');
  a.download = filename;
  a.href = data;
  a.click();
}
