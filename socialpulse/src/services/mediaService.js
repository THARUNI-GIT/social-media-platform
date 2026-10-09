import api, { unwrap, fail } from "./api";
/** Presign -> POST straight to MinIO (fields first, file LAST) -> returns the public URL. */
export async function uploadImage(file, kind = "post") {
  const p = await api.post("/media/uploads", { kind, contentType: file.type, size: file.size }).then(unwrap).catch(fail);
  const fd = new FormData(); Object.entries(p.fields).forEach(([k, v]) => fd.append(k, v)); fd.append("file", file);
  const r = await fetch(p.uploadUrl, { method: "POST", body: fd });
  if (!r.ok) throw new Error("Upload failed");
  return p.publicUrl;
}
