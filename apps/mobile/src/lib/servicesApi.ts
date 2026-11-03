import type { ServiceRow } from "./posApi";
import { failure, session } from "./scanApi";
import type { FetchFn } from "./signIn";

/** ตั้งค่าบริการ's saves (the list itself comes from posApi's fetchServices, as ทำบิล reads it). */

type ServiceBody = { name: string; nameEn: string; basePriceSatang: number };

const serviceUrl = (base: string, id: string) => `${base}/services/${encodeURIComponent(id)}`;

const sending = (token: string, method: string, body: ServiceBody) => ({
  method,
  headers: { ...session(token), "content-type": "application/json" },
  body: JSON.stringify(body),
});

export async function addService(
  fetchFn: FetchFn,
  base: string,
  token: string,
  body: ServiceBody,
): Promise<ServiceRow> {
  const res = await fetchFn(`${base}/services`, sending(token, "POST", body));
  if (!res.ok) throw await failure(res, "Service not saved");
  return (await res.json()) as ServiceRow;
}

export async function updateService(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
  body: ServiceBody,
): Promise<void> {
  const res = await fetchFn(serviceUrl(base, id), sending(token, "PATCH", body));
  if (!res.ok) throw await failure(res, "Service not saved");
}

export async function deleteService(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
): Promise<void> {
  const res = await fetchFn(serviceUrl(base, id), { method: "DELETE", headers: session(token) });
  if (!res.ok) throw await failure(res, "Service not deleted");
}
