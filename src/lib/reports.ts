/** Reasons for reporting a link (see AbuseReport). */
export const REPORT_REASONS = ["PHISHING", "MALWARE", "ILLEGAL", "SPAM", "OTHER"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
