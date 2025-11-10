export const REPORT_STATUS = {
  NEW: 'nova',
  IN_PROGRESS: 'em_analise',
  RESOLVED: 'resolvida',
};

export const REPORT_STATUS_OPTIONS = [
  { value: REPORT_STATUS.NEW, label: 'Nova' },
  { value: REPORT_STATUS.IN_PROGRESS, label: 'Em análise' },
  { value: REPORT_STATUS.RESOLVED, label: 'Resolvida' },
];

export const getStatusLabel = (statusValue) => {
  if (!statusValue) {
    return 'Indefinido';
  }
  const option = REPORT_STATUS_OPTIONS.find((item) => item.value === statusValue);
  return option ? option.label : statusValue;
};
