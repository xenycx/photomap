import { writable } from "svelte/store";

const KEY = "mapStyle";

function getInitial(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(KEY) || "";
}

export const mapStyleUrl = writable<string>(getInitial());

if (typeof localStorage !== "undefined") {
  mapStyleUrl.subscribe((value) => {
    if (value) localStorage.setItem(KEY, value);
  });
}
