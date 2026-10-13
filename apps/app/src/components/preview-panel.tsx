"use client";

import { useState, type CSSProperties } from "react";
import { Icon } from "./icons";
import { PdfPreview } from "./pdf-preview";
import styles from "./preview-panel.module.css";
import { Badge, Button } from "./ui";
import type { CaptureResult } from "@/lib/capture";
import { DEVICE_PRESETS } from "@screenshotapi/contracts";

function PreviewContent({
  result,
  pending,
  device,
  localCapture = false,
}: {
  result: CaptureResult | null;
  pending: boolean;
  device: string;
  localCapture?: boolean;
}) {
  if (pending || result?.pending) {
    const job = result?.pending ? result : null;
    return (
      <div className={styles.stageMessage} role="status">
        <span className="relative flex size-11 items-center justify-center">
          <span className="absolute size-11 animate-ping rounded-pill bg-accent/25" />
          <span className="relative flex size-9 items-center justify-center rounded-pill bg-accent/20 text-accent-ink">
            <Icon name="sparkles" className="size-4" />
          </span>
        </span>
        <p className="font-display text-sm font-semibold text-ink">{localCapture || job?.state === "active" ? "Rendering" : "Queued"}</p>
        <p className="max-w-xs text-sm text-ink-3">
          {localCapture ? "Preparing your capture. Keep this page open until it finishes." : job?.state === "active" ? "Preparing a complete capture. You can reload this page and check its progress." : "Your capture is waiting to start. You can reload this page without submitting it again."}
        </p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className={styles.stageMessage} aria-label="Empty capture preview"><Icon name="device" className="size-8" /><p>Your screenshot will appear here</p></div>
    );
  }

  if (!result.ok) {
    return (
      <div className={styles.stageMessage} role="alert">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge tone="danger" icon="alert">
              {result.error.code}
            </Badge>
            <p className="mt-3 font-display text-base font-semibold text-ink">
              {result.error.message}
            </p>
            <p className="mt-1 font-mono text-xs text-ink-3">
              request {result.error.request_id} · {result.error.retriable ? "retriable" : "terminal"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { metrics, image } = result;
  const isPdf = metrics.format === "pdf";
  const deviceScaleFactor = isPdf ? 1 : metrics.render_diagnostics?.device_scale_factor ?? 1;
  const previewWidth = metrics.width / deviceScaleFactor;
  const renderedImage = image ? (
    isPdf ? (
      <PdfPreview src={image} width={previewWidth} />
    ) : (
      <img src={image} alt="Rendered screenshot preview" className="block h-auto w-full" />
    )
  ) : null;

  return (
    <div className="mx-auto w-full max-w-full" style={{ width: DEVICE_PRESETS[device]?.viewport.isMobile ? "100%" : previewWidth }}>
      {renderedImage}
    </div>
  );
}

export function PreviewPanel({ result, pending, device, url, localCapture = false, creditCost = 1, onReset, onCapture }: {
  url: string;
  result: CaptureResult | null;
  pending: boolean;
  device: string;
  localCapture?: boolean;
  creditCost?: number;
  onReset: () => void;
  onCapture: () => void;
}) {
  const [copyStatus, setCopyStatus] = useState("Copy link");
  const capture = !pending && result?.ok && !result.pending ? result : null;
  const image = capture?.image;
  const extension = capture?.metrics.format === "jpeg" ? "jpg" : capture?.metrics.format;
  const displayedUrl = capture?.metrics.final_url || url;
  let domain = "New capture";
  try { domain = new URL(/^https?:\/\//i.test(displayedUrl) ? displayedUrl : `https://${displayedUrl}`).hostname; } catch {}

  const preset = DEVICE_PRESETS[device];
  const isDevice = !!preset?.viewport.isMobile;
  const frameClass = device.startsWith("ipad") ? styles.tabletFrame : device.startsWith("iphone") ? styles.iphoneFrame : styles.androidFrame;
  const deviceStyle = preset ? {
    "--device-ratio": preset.viewport.width / preset.viewport.height,
    "--device-width": `${preset.viewport.width + 22}px`,
  } as CSSProperties : undefined;
  const content = <PreviewContent result={result} pending={pending} device={device} localCapture={localCapture} />;

  return (
    <section className={styles.panel} aria-label="Capture preview">
      <div className={styles.actions}>
        <h2 className={styles.previewTitle}>Preview</h2>
        {image && <>
          {image.startsWith("/c/") && <Button variant="secondary" aria-label="Copy capture link" onClick={async () => {
            try {
              await navigator.clipboard.writeText(new URL(image, window.location.origin).href);
              setCopyStatus("Link copied");
            } catch { setCopyStatus("Copy failed"); }
          }}><Icon name="copy" className="size-4" /><span role="status">{copyStatus}</span></Button>}
          <a href={image.startsWith("/c/") ? `${image}?download=1` : image} download={`screenshotapi-${capture.metrics.width}x${capture.metrics.height}.${extension}`} aria-label="Save capture" className="inline-flex items-center gap-2 rounded-md border border-line bg-raised px-3 py-2 text-xs font-medium text-ink"><Icon name="download" className="size-4" />Save</a>
        </>}
        <Button variant="ghost" onClick={onReset} disabled={pending}><Icon name="refresh" className="size-4" />Reset</Button>
        <Button variant="primary" onClick={onCapture} disabled={pending}><Icon name="play" className="size-4" />{pending ? "Capturing…" : `Capture · ${creditCost} ${creditCost === 1 ? "credit" : "credits"}`}</Button>
      </div>
      <div className={styles.previewArea}>
        {isDevice ? (
          <div className={styles.deviceStage} style={deviceStyle}>
            <div className={`${styles.deviceFrame} ${frameClass}`} role="group" aria-label={`${preset.name} preview`}>
              <span className={styles.deviceButton} aria-hidden="true" />
              <div className={styles.deviceStatusBar} aria-hidden="true">
                <span className={styles.deviceTime}>9:41</span>
                <span className={styles.deviceIsland} />
                <span className={styles.deviceIndicators}><span className={styles.signal} /><span className={styles.battery} /></span>
              </div>
              <div className={styles.deviceScreen} aria-busy={pending || !!result?.pending}>{content}</div>
              <div className={styles.deviceHomeBar} aria-hidden="true"><span /></div>
            </div>
            <p className={styles.deviceCaption} title={displayedUrl}>{preset.name} · {domain}</p>
          </div>
        ) : (
        <div className={styles.browserWindow}>
          <div className={styles.browserBar}>
            <span className={styles.windowControls} aria-hidden="true"><span className={styles.closeDot} /><span className={styles.minimizeDot} /><span className={styles.maximizeDot} /></span>
            <span className={styles.browserTab} title={displayedUrl || domain}><Icon name="device" className="size-3 shrink-0" /><span>{domain}</span></span>
          </div>
          <div className={styles.browserScreen} aria-busy={pending || !!result?.pending}>
            {content}
          </div>
        </div>
        )}
      </div>
    </section>
  );
}
