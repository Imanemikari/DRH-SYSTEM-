export interface Department {
  id: number;
  name: string;
  description: string;
  manager: string;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: number;
  matricule: string;
  first_name: string;
  last_name: string;
  marital_status: string;
  phone: string;
  address: string;
  date_of_birth: string;
  hire_date: string;
  end_date: string;
  department_id: number;
  department_name?: string;
  position: string;
  contract_type: string;
  salary: number;
  status: string;
  photo_path: string;
  gender: string;
  national_id: string;
  social_security: string;
  nb_enfants: number;
  bank_account: string;
  notes: string;
  transport?: string;
  national_id_type?: string;
  nuisance_pct?: number;
  ifsp_pct?: number;
  ifep_pct?: number;
  prime_technicite?: number;
  prime_sujetion?: number;
  prime_responsabilite?: number;
  prime_zone?: number;
  created_at: string;
  updated_at: string;
}

export interface EmployeeDocument {
  id: number;
  employee_id: number;
  document_name: string;
  document_type: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
}

export interface Attendance {
  id: number;
  employee_id: number;
  first_name?: string;
  last_name?: string;
  date: string;
  check_in: string;
  check_out: string;
  status: string;
  notes: string;
}

export interface Leave {
  id: number;
  employee_id: number;
  first_name?: string;
  last_name?: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  status: string;
  approved_by: string;
}

export interface Stats {
  totalEmployees: number;
  activeEmployees: number;
  totalDepartments: number;
  pendingLeaves: number;
  todayAttendance: number;
  totalPayroll: number;
  recentEmployees: any[];
  departmentStats: any[];
  expiringContracts: number;
}

export interface Settings {
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
}
