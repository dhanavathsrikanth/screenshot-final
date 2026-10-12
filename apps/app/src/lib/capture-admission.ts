export {
  CAPTURE_ADMISSION_DEFAULTS,
  CaptureAdmissionError,
  MemoryCaptureAdmission,
  RedisCaptureAdmission,
  createCaptureAdmission,
  acquireCaptureAdmission,
} from "@screenshotapi/queue";
export type { CaptureLease, CaptureAdmission, AdmissionRedis } from "@screenshotapi/queue";
