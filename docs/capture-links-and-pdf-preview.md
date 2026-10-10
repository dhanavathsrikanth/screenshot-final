# Capture links and PDF preview

Hosted playground results use `/c/<compact-job-id>` on the dashboard origin. The preview streams the artifact through this route, avoiding browser CORS requirements on private object storage. Copy link resolves the path against the current origin, so the same implementation supports a custom domain attached to the Vercel project.

Links require the capture owner's Clerk session. They work while the job result is retained (24 hours by default) and the object exists. Storage signatures are renewed on each visit; the original one-hour presigned URL is not reused. These are account links, not public sharing links.

Configure the same bucket on Vercel as on the worker: `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_BUCKET`, `STORAGE_ENDPOINT`, `STORAGE_REGION`, and `STORAGE_FORCE_PATH_STYLE`. Keep credentials in server-only environment variables. For the current Railway bucket use region `iad` and force path style `false`.

The delivery route validates ownership and the configured bucket's capture object path before signing, streams rather than buffers the file, preserves byte ranges, serves PDF as `application/pdf` with inline disposition, and uses private no-store caching. The Save action requests attachment disposition.
