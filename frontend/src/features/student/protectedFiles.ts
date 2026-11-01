import { ApiError } from "../../api/client";
/** Fresh authorization for every click. No storage URL or persistent cache. */
export async function downloadProtectedFile(
  id: string,
  name: string,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL ?? ""}/api/v1/files/${encodeURIComponent(id)}/content`,
      { credentials: "same-origin", cache: "no-store", redirect: "error" },
    );
  } catch {
    throw new ApiError("network");
  }
  if (!response.ok)
    throw new ApiError(
      response.status === 401
        ? "unauthorized"
        : response.status === 403
          ? "forbidden"
          : response.status === 404
            ? "notFound"
            : response.status === 409
              ? "conflict"
              : response.status >= 500
                ? "server"
                : "unknown",
      response.status,
    );
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = Array.from(name, (c) =>
    c.charCodeAt(0) < 32 || c === "/" || c === "\\" ? "_" : c,
  ).join("");
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
