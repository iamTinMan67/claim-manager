
export interface ClaimFieldConfig {
  caseNumber: boolean;
  court: boolean;
  plaintiff: boolean;
  defendant: boolean;
  status: boolean;
}

export interface EvidenceFieldConfig {
  exhibitId: boolean;
  fileName: boolean;
  pages: boolean;
  method: boolean;
  date: boolean;
  bundlePage: boolean;
}

export interface PDFFieldConfig {
  claimFields: ClaimFieldConfig;
  evidenceFields: EvidenceFieldConfig;
}

export const DEFAULT_CLAIM_FIELDS: ClaimFieldConfig = {
  caseNumber: true,
  court: true,
  plaintiff: true,
  defendant: true,
  status: true,
};

export const DEFAULT_EVIDENCE_FIELDS: EvidenceFieldConfig = {
  exhibitId: true,
  fileName: true,
  pages: true,
  method: true,
  date: true,
  bundlePage: true,
};

export const CLAIM_FIELD_LABELS: Record<keyof ClaimFieldConfig, string> = {
  caseNumber: 'Case Number',
  court: 'Court',
  plaintiff: 'Plaintiff',
  defendant: 'Defendant',
  status: 'Status',
};

export const EVIDENCE_FIELD_LABELS: Record<keyof EvidenceFieldConfig, string> = {
  exhibitId: '#',
  fileName: 'File Name',
  pages: 'Pages',
  method: 'Method',
  date: 'Date',
  bundlePage: 'Bundle Pos',
};
