import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { captureRequestSchema, captureSuccessDataSchema, errorEnvelopeSchema } from "../../../packages/contracts/dist/index.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(root + path, "utf8");
const config = JSON.parse(read("docs.json"));
const spec = JSON.parse(read("openapi.json"));
assert.equal(spec.servers[0].url, "https://api.screenshotapi.tech", "OpenAPI must use the hosted API origin");
assert.deepEqual(spec.security, [{ bearerAuth: [] }], "Protected API routes require Bearer authentication");
const pages = [];
function scan(directory = "") {
  for (const entry of readdirSync(root + directory, { withFileTypes: true })) {
    if (["scripts", "examples", "node_modules", ".mintlify"].includes(entry.name)) continue;
    const path = directory + entry.name;
    if (entry.isDirectory()) scan(path + "/");
    else if (entry.name.endsWith(".mdx")) pages.push(path);
  }
}
scan();
const slugs = new Set(pages.map((path) => path.slice(0, -4)));
const navigated = new Set();
function navigation(item) {
  for (const [key, value] of Object.entries(item)) {
    if (key === "pages") for (const slug of value) {
      assert.equal(typeof slug, "string");
      assert(slugs.has(slug), "Missing navigation page: " + slug);
      assert(!navigated.has(slug), "Duplicate navigation page: " + slug);
      navigated.add(slug);
    }
    else if (Array.isArray(value)) value.forEach((entry) => typeof entry === "object" && navigation(entry));
    else if (value && typeof value === "object") navigation(value);
  }
}
navigation(config.navigation);
assert.equal(navigated.size, slugs.size, "Every guide must be reachable through navigation");
function references(value) {
  if (!value || typeof value !== "object") return;
  if (value.$ref) {
    assert(value.$ref.startsWith("#/"), "Only internal OpenAPI refs are supported");
    let resolved = spec;
    for (const key of value.$ref.slice(2).split("/")) resolved = resolved?.[key];
    assert(resolved, "Missing OpenAPI reference: " + value.$ref);
  }
  Object.values(value).forEach(references);
}
references(spec);
assert.deepEqual(Object.keys(spec.components.schemas.CaptureRequest.properties).sort(), Object.keys(captureRequestSchema.shape).sort());
for (const [key, field] of Object.entries(captureRequestSchema.shape)) {
  const documented = spec.components.schemas.CaptureRequest.properties[key];
  assert(documented.description, "Missing description for " + key);
  if (field._def.typeName === "ZodDefault") assert.deepEqual(documented.default, field._def.defaultValue(), "Default drift for " + key);
}
let samples = 0;
for (const path of pages) {
  const source = read(path);
  assert(!source.includes("SCREENSHOTAPI_BASE_URL") && !source.includes("YOUR_API_ORIGIN"), "Unresolved API origin in " + path);
  assert(/^---\r?\n/.test(source), "Missing frontmatter: " + path);
  assert(/^title: "[^"\n]+"/m.test(source), "Missing title: " + path);
  assert(/^description: "[^"\n]+"/m.test(source), "Missing description: " + path);
  for (const match of source.matchAll(/(?:href="|\]\()\/(?!\/)([^"\s)#]*)(?:#[^"\s)]*)?/g)) {
    assert(slugs.has(match[1]), "Broken internal link in " + path + ": " + match[1]);
  }
  for (const match of source.matchAll(/```json\r?\n([\s\S]*?)```/g)) {
    const value = JSON.parse(match[1]);
    if (value.url) captureRequestSchema.parse(value);
    if (value.ok === false) errorEnvelopeSchema.parse(value.error);
    if (value.ok === true && value.data?.cdn_url) captureSuccessDataSchema.parse(value.data);
    if (value.ok === true && value.data?.result?.ok) captureSuccessDataSchema.parse(value.data.result.data);
    samples++;
  }
}
for (const [page, sample, language] of [["integration/node.mdx", "examples/capture.mjs", "javascript"], ["integration/python.mdx", "examples/capture.py", "python"]]) {
  const block = read(page).match(new RegExp("```" + language + "\\r?\\n([\\s\\S]*?)```"));
  assert(block, "Missing executable sample in " + page);
  assert.equal(block[1].replaceAll("\r\n", "\n"), read(sample).replaceAll("\r\n", "\n"), "Sample drift in " + page);
}
console.log("Checked " + pages.length + " pages, " + samples + " JSON examples, navigation, internal links, schema defaults, OpenAPI references, and language samples.");
