/** บันทึกรูป on a slip: the picture already on screen goes to the phone's downloads. */
export async function saveImage(uri: string, fileName: string): Promise<void> {
  const a = document.createElement("a");
  a.href = uri;
  a.download = fileName;
  a.click();
}
