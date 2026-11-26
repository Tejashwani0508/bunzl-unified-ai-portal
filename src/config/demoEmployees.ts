export interface DemoEmployee {
  id: string
  name: string
  designation: string
  role: string
}

export const demoEmployees: DemoEmployee[] = [
  { id: 'EMP001', name: 'Tejashwani Paidi', designation: 'Employee', role: 'employee' },
  { id: 'EMP002', name: 'Ashok', designation: 'Employee', role: 'employee' },
  { id: 'EMP003', name: 'Anupama', designation: 'Employee', role: 'employee' },
]

export const DEMO_EMPLOYEE_SESSION_KEY = 'bunzl-demo-employee-session-v1'

export function findDemoEmployee(id: string) {
  return demoEmployees.find((employee) => employee.id === id)
}
