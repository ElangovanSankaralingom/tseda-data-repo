export type TimerConfig = {
  defaultWindowDays: number;
  streakBufferDays: number;
  pauseOnRequest: boolean;
  autoFinaliseOnExpiry: boolean;
  autoDeleteOnExpiry: boolean;
};

export type RequestConfig = {
  maxEditRequests: number;
  maxDeleteRequests: number;
  rejectLocksEntry: boolean;
  cancelLocksEntry: boolean;
};

export type CompletionConfig = {
  requireAllStage1: boolean;
  requireAllStage2: boolean;
  requireFreshPdf: boolean;
};

export type AutoActionConfig = {
  deleteIncompleteOnExpiry: boolean;
  finaliseCompleteOnExpiry: boolean;
  deleteStaleOnExpiry: boolean;
};

export type WorkflowConfig = {
  timer: TimerConfig;
  requests: RequestConfig;
  completion: CompletionConfig;
  autoActions: AutoActionConfig;
};

export const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
  timer: {
    defaultWindowDays: 3,
    streakBufferDays: 8,
    pauseOnRequest: true,
    autoFinaliseOnExpiry: true,
    autoDeleteOnExpiry: true,
  },
  requests: {
    maxEditRequests: 1,
    maxDeleteRequests: 1,
    rejectLocksEntry: true,
    cancelLocksEntry: true,
  },
  completion: {
    requireAllStage1: true,
    requireAllStage2: true,
    requireFreshPdf: true,
  },
  autoActions: {
    deleteIncompleteOnExpiry: true,
    finaliseCompleteOnExpiry: true,
    deleteStaleOnExpiry: true,
  },
};
