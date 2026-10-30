import {
  Customer,
  QuotationItem,
  ApplicationStepMaster,
  ApplicationMethod,
  PackingMapping,
  Project,
  ProjectRevision,
  CoatingCostSummary,
  BomSummary,
  UserRole,
  RevisionStatus,
  UserAccount,
  AuthSessionResponse,
  PaginatedResponse
} from '@cscc/shared';

const API_BASE = '/api';
const AUTH_TOKEN_KEY = 'cscc_auth_token';

export function getStoredAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredAuthToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

async function request<T>(
  path: string,
  role: UserRole,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredAuthToken();
  const headers: Record<string, string> = {
    'x-user-role': role,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...((options.headers as Record<string, string>) || {})
  };
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(errBody.message || errBody.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const apiClient = {
  downloadTemplate: async (role: UserRole, type: 'customers' | 'quotations') => {
    const token = getStoredAuthToken();
    const res = await fetch(`${API_BASE}/master/templates/${type}`, {
      headers: {
        'x-user-role': role,
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = `template-${type}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  },
  // Authentication & User Accounts (PostgreSQL `User` Table)
  login: (email: string, password: string) =>
    request<AuthSessionResponse>('/auth/login', 'PROJECT_LEADER', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),

  getMe: (role: UserRole) => request<{ user: UserAccount }>('/auth/me', role),

  getUsers: (role: UserRole) => request<UserAccount[]>('/auth/users', role),

  saveUser: (
    role: UserRole,
    data: { email: string; fullName: string; password?: string; role: UserRole }
  ) =>
    request<UserAccount>('/auth/users', role, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  deleteUser: (role: UserRole, id: string) =>
    request<{ deleted: boolean }>(`/auth/users/${id}`, role, { method: 'DELETE' }),

  // Master Data: Customers
  getCustomers: (role: UserRole, q = '') =>
    request<Customer[]>(`/master/customers?q=${encodeURIComponent(q)}`, role),

  getCustomersPaged: (role: UserRole, q = '', page = 1, pageSize = 50) =>
    request<PaginatedResponse<Customer>>(
      `/master/customers/paged?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`,
      role
    ),

  saveCustomer: (
    role: UserRole,
    data: Partial<Customer> & { customerId: string; customerName: string }
  ) =>
    data.id
      ? request<Customer>(`/master/customers/${data.id}`, role, {
        method: 'PUT',
        body: JSON.stringify(data)
      })
      : request<Customer>('/master/customers', role, {
        method: 'POST',
        body: JSON.stringify(data)
      }),

  deleteCustomer: (role: UserRole, id: string) =>
    request<{ deleted: boolean }>(`/master/customers/${id}`, role, { method: 'DELETE' }),

  importCustomersFile: (role: UserRole, fileBase64: string) =>
    request<{ created: number; updated: number; skipped: number; total: number }>(
      '/master/customers/import',
      role,
      { method: 'POST', body: JSON.stringify({ fileBase64 }) }
    ),

  // Master Data: Quotations
  getQuotations: (role: UserRole, customerCode = '', q = '', limit = 400) =>
    request<QuotationItem[]>(
      `/master/quotations?customerCode=${encodeURIComponent(customerCode)}&q=${encodeURIComponent(q)}&limit=${limit}`,
      role
    ),

  getQuotationsPaged: (
    role: UserRole,
    customerCode = '',
    q = '',
    page = 1,
    pageSize = 50
  ) =>
    request<PaginatedResponse<QuotationItem>>(
      `/master/quotations/paged?customerCode=${encodeURIComponent(customerCode)}&q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`,
      role
    ),

  saveQuotation: (role: UserRole, data: Partial<QuotationItem>) =>
    data.id
      ? request<QuotationItem>(`/master/quotations/${data.id}`, role, {
        method: 'PUT',
        body: JSON.stringify(data)
      })
      : request<QuotationItem>('/master/quotations', role, {
        method: 'POST',
        body: JSON.stringify(data)
      }),

  importQuotationsFile: (role: UserRole, fileBase64: string) =>
    request<{ created: number; updated: number; skipped: number; total: number }>(
      '/master/quotations/import',
      role,
      { method: 'POST', body: JSON.stringify({ fileBase64 }) }
    ),

  deleteQuotation: (role: UserRole, id: string) =>
    request<{ deleted: boolean }>(`/master/quotations/${id}`, role, { method: 'DELETE' }),

  getStepsMaster: (role: UserRole) =>
    request<ApplicationStepMaster[]>('/master/steps', role),

  saveStepMaster: (role: UserRole, data: Partial<ApplicationStepMaster>) =>
    data.id
      ? request<ApplicationStepMaster>(`/master/steps/${data.id}`, role, {
        method: 'PUT',
        body: JSON.stringify(data)
      })
      : request<ApplicationStepMaster>('/master/steps', role, {
        method: 'POST',
        body: JSON.stringify(data)
      }),

  deleteStepMaster: (role: UserRole, id: string) =>
    request<{ deleted: boolean }>(`/master/steps/${id}`, role, { method: 'DELETE' }),

  getMethodsMaster: (role: UserRole) =>
    request<ApplicationMethod[]>('/master/methods', role),

  saveMethodMaster: (role: UserRole, data: Partial<ApplicationMethod>) =>
    data.id
      ? request<ApplicationMethod>(`/master/methods/${data.id}`, role, {
        method: 'PUT',
        body: JSON.stringify(data)
      })
      : request<ApplicationMethod>('/master/methods', role, {
        method: 'POST',
        body: JSON.stringify(data)
      }),

  deleteMethodMaster: (role: UserRole, id: string) =>
    request<{ deleted: boolean }>(`/master/methods/${id}`, role, { method: 'DELETE' }),

  getPackingsMaster: (role: UserRole) =>
    request<PackingMapping[]>('/master/packings', role),

  savePackingMaster: (role: UserRole, data: Partial<PackingMapping>) =>
    data.id
      ? request<PackingMapping>(`/master/packings/${data.id}`, role, {
        method: 'PUT',
        body: JSON.stringify(data)
      })
      : request<PackingMapping>('/master/packings', role, {
        method: 'POST',
        body: JSON.stringify(data)
      }),

  deletePackingMaster: (role: UserRole, id: string) =>
    request<{ deleted: boolean }>(`/master/packings/${id}`, role, { method: 'DELETE' }),

  importExcelMaster: (
    role: UserRole,
    payload: { fileBase64?: string; resetGoldenProject?: boolean }
  ) =>
    request<{ imported: boolean; counts: Record<string, number> }>(
      '/master/import-excel',
      role,
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    ),

  getProjects: (role: UserRole) => request<Project[]>('/projects', role),

  createProject: (role: UserRole, payload: Record<string, unknown>) =>
    request<{ project: Project; revision: ProjectRevision }>('/projects', role, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  deleteProject: (role: UserRole, id: string) =>
    request<{ deleted: boolean }>(`/projects/${id}`, role, { method: 'DELETE' }),

  getRevision: (role: UserRole, id: string) =>
    request<ProjectRevision>(`/revisions/${id}`, role),

  deleteRevision: (role: UserRole, id: string) =>
    request<{ deleted: boolean }>(`/revisions/${id}`, role, { method: 'DELETE' }),

  updateRevision: (role: UserRole, id: string, payload: Partial<ProjectRevision> & { customerId?: string }) =>
    request<{
      revision: ProjectRevision;
      costSummary: CoatingCostSummary | null;
      bomSummary: BomSummary;
    }>(`/revisions/${id}`, role, {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),

  cloneRevision: (role: UserRole, id: string, refreshPrices = true) =>
    request<ProjectRevision>(`/revisions/${id}/clone`, role, {
      method: 'POST',
      body: JSON.stringify({ refreshPrices })
    }),

  updateRevisionStatus: (role: UserRole, id: string, status: RevisionStatus) =>
    request<ProjectRevision>(`/revisions/${id}/status`, role, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    }),

  refreshRevisionPrices: (role: UserRole, id: string) =>
    request<ProjectRevision>(`/revisions/${id}/refresh-prices`, role, {
      method: 'POST'
    }),

  getExcelDownloadUrl: (id: string, role: UserRole, areaM2: number) =>
    `${API_BASE}/revisions/${id}/export-excel?role=${role}&areaM2=${areaM2}`
};
